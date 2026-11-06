import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit/log";
import { formatDate, formatMoney } from "@/lib/format";
import { sanctionSource } from "@/lib/sanctions/sources";
import { LOCKED_TRANSACTION, hasPendingPurchase, uniqueReference } from "./payments";
import { activateSubscription, activeSubscription, createSubscription } from "./subscriptions";
import { changeBalance, getWallet, lockWallet } from "./wallet";

const DAY_MS = 24 * 60 * 60 * 1000;

// Хугацаа нь дууссан идэвхтэй багцыг тухайн багцын одоогийн үнээр хэтэвчнээс сунгана.
// Үлдэгдэл хүрэлцэхгүй бол багцыг дуусгалгүй "төлбөр хүлээж буй" (ACTIVE, хугацаа нь
// дууссан) хэвээр үлдээнэ: энэ хооронд үйлчилгээ ашиглах боломжгүй, хэтэвч цэнэглэгдсэний
// дараах дараагийн шалгалтаар (цэнэглэлт, үйлчилгээ ашиглах, багцын хуудас, cron) сунгагдана.
// Багц идэвхгүй болсон эсвэл өөр багцын төлбөр хүлээгдэж буй бол дуусгана (дахин оролдохгүй).
// Өмнөх багцын үлдсэн тоо шилжихгүй. Буцаах: шинэ захиалга эсвэл null
export async function renewExpiredSubscription(organizationId) {
  const now = new Date();
  const expired = await prisma.subscription.findFirst({
    where: { organizationId, status: "ACTIVE", expiresAt: { lte: now } },
    orderBy: { expiresAt: "desc" },
    select: { id: true },
  });
  if (!expired) return null;

  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, organizationId);
    // Зэрэг ирсэн хүсэлт аль хэдийн сунгасан эсвэл дуусгасан байж болно
    const previous = await tx.subscription.findUnique({ where: { id: expired.id } });
    if (previous.status !== "ACTIVE") return null;
    // Дууссан хугацааг хэвээр үлдээж төлөвийг нь л солино
    const end = () => tx.subscription.update({ where: { id: previous.id }, data: { status: "ENDED" } });

    if ((await activeSubscription(organizationId, tx)) || (await hasPendingPurchase(tx, organizationId))) {
      await end();
      return null;
    }
    const pkg = previous.packageId
      ? await tx.package.findFirst({ where: { id: previous.packageId, status: "ACTIVE" }, include: { items: true } })
      : null;
    if (!pkg) {
      await end();
      return null;
    }
    const wallet = await getWallet(organizationId, tx);
    if (wallet.balance < pkg.basePrice) return null;

    await end();
    const subscription = await createSubscription(pkg, organizationId, tx);
    if (pkg.basePrice > 0) {
      const payment = await tx.payment.create({
        data: {
          organizationId,
          purpose: "PACKAGE_PURCHASE",
          method: "WALLET",
          status: "PAID",
          amount: pkg.basePrice,
          subscriptionId: subscription.id,
          reference: await uniqueReference(),
          paidAt: now,
        },
      });
      await changeBalance(tx, {
        organizationId,
        amount: -pkg.basePrice,
        type: "PACKAGE_PURCHASE",
        description: `"${pkg.name}" багцыг автоматаар сунгав`,
        paymentId: payment.id,
      });
    }
    const renewed = await activateSubscription(tx, subscription.id);
    return { ...renewed, price: pkg.basePrice };
  }, LOCKED_TRANSACTION).then(async (renewed) => {
    // Хэрэглэгчийн үйлдэл биш (систем) тул actor хоосон
    if (renewed) {
      await logAudit({
        action: "billing.renew_auto",
        organizationId,
        entity: { type: "Subscription", id: renewed.id },
        summary: `"${renewed.packageName}" багцыг хэтэвчнээс ${formatMoney(renewed.price)} суутгаж автоматаар сунгав`,
      });
    }
    return renewed;
  });
}

// Хэтэвч хүрэлцээгүйгээс сунгагдаагүй, төлбөр хүлээж буй багц ба нэмэлт жагсаалтууд,
// бүгдийг (багц → нэмэлт жагсаалт дарааллаар) сунгахад шаардлагатай нийт дүн.
// Буцаах: { subscription: { packageName, expiresAt, price } | null, addons: [{ source, name, price }], total }
// эсвэл хүлээгдэж буй сунгалт байхгүй бол null
export async function awaitingRenewal(organizationId) {
  const now = new Date();
  const [expired, latest, settings] = await Promise.all([
    prisma.subscription.findFirst({
      where: { organizationId, status: "ACTIVE", expiresAt: { lte: now } },
      orderBy: { expiresAt: "desc" },
      select: { packageName: true, expiresAt: true, package: { select: { basePrice: true, status: true } } },
    }),
    latestAddons(organizationId),
    prisma.sourceAddon.findMany({ where: { status: "ACTIVE" } }),
  ]);
  const subscription =
    expired?.package?.status === "ACTIVE"
      ? { packageName: expired.packageName, expiresAt: expired.expiresAt, price: expired.package.basePrice }
      : null;
  // Нэмэлт жагсаалт идэвхтэй багц шаарддаг: багцгүй (хүлээгдэж буй ч биш) бол цэнэглэсэн ч сунгагдахгүй
  const hasPackage = Boolean(subscription || (await activeSubscription(organizationId)));
  const addons = latest.flatMap((row) => {
    const setting = settings.find((item) => item.source === row.source);
    if (!hasPackage || !row.autoRenew || row.expiresAt > now || !setting) return [];
    return [{ source: row.source, name: sanctionSource(row.source).name, price: setting.price }];
  });
  if (!subscription && !addons.length) return null;
  const total = (subscription?.price ?? 0) + addons.reduce((sum, addon) => sum + addon.price, 0);
  return { subscription, addons, total };
}

// Жагсаалт бүрийн хамгийн сүүлийн хугацааны мөр (автомат сунгалтын тохиргоо түүнд бий)
export const latestAddons = (organizationId, db = prisma) =>
  db.organizationAddon.findMany({
    where: { organizationId },
    orderBy: [{ source: "asc" }, { expiresAt: "desc" }],
    distinct: ["source"],
  });

// Шинэ хугацааны мөр үүсэхэд өмнөх мөрүүдийн автомат сунгалтыг унтраана: тохиргоо зөвхөн
// хамгийн сүүлийн мөрөнд үлдэж, cron хуучин мөрүүдийг дахин шалгахгүй.
export const retireOlderAddons = (tx, row) =>
  tx.organizationAddon.updateMany({
    where: { organizationId: row.organizationId, source: row.source, id: { not: row.id }, autoRenew: true },
    data: { autoRenew: false },
  });

// Нэг нэмэлт жагсаалтыг одоогийн үнээр сунгана. Идэвхтэй багц, хэтэвчний үлдэгдэл
// хүрэлцэхгүй, худалдаалахаа больсон бол сунгахгүй (автомат сунгалт асаалттай хэвээр тул
// дараагийн шалгалтаар дахин оролдоно). Буцаах: шинэ мөр эсвэл null
async function renewAddon(organizationId, source) {
  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, organizationId);
    const now = new Date();
    const latest = (await latestAddons(organizationId, tx)).find((row) => row.source === source);
    if (!latest?.autoRenew || latest.expiresAt > now) return null;

    const addon = await tx.sourceAddon.findFirst({ where: { source, status: "ACTIVE" } });
    if (!addon || !(await activeSubscription(organizationId, tx))) return null;
    if ((await getWallet(organizationId, tx)).balance < addon.price) return null;

    // Хугацаа дууссанаас хойш ашиглаагүй хугацааг тооцохгүй, одооноос эхэлнэ
    const renewed = await tx.organizationAddon.create({
      data: {
        organizationId,
        source,
        price: addon.price,
        startsAt: now,
        expiresAt: new Date(now.getTime() + addon.durationDays * DAY_MS),
      },
    });
    await retireOlderAddons(tx, renewed);
    if (addon.price > 0) {
      await changeBalance(tx, {
        organizationId,
        amount: -addon.price,
        type: "ADDON_PURCHASE",
        description: `${sanctionSource(source).name}-ийг автоматаар сунгав (${addon.durationDays} хоног)`,
      });
    }
    return renewed;
  }, LOCKED_TRANSACTION);
}

// Автомат сунгалт асаалттай, хугацаа нь дууссан нэмэлт жагсаалтуудыг сунгана.
// Буцаах: сунгагдсан мөрүүд
export async function renewExpiredAddons(organizationId) {
  const now = new Date();
  const due = (await latestAddons(organizationId)).filter((row) => row.autoRenew && row.expiresAt <= now);
  const renewed = [];
  for (const { source } of due) {
    const row = await renewAddon(organizationId, source);
    if (!row) continue;
    renewed.push(row);
    await logAudit({
      action: "billing.addon_renew_auto",
      organizationId,
      entity: { type: "OrganizationAddon", id: row.id },
      summary: `${sanctionSource(source).name} нэмэлт жагсаалтыг хэтэвчнээс ${formatMoney(row.price)} суутгаж ${formatDate(row.expiresAt)} хүртэл сунгав`,
      metadata: { source, price: row.price, startsAt: row.startsAt, expiresAt: row.expiresAt },
    });
  }
  return renewed;
}

// Байгууллагын хугацаа нь дууссан багц, дараа нь нэмэлт жагсаалтуудыг (идэвхтэй багц
// шаардлагатай тул энэ дарааллаар) сунгана. Үйлчилгээ ашиглах, багцын хуудас, хэтэвч
// цэнэглэх, cron бүрт дуудагдана.
export async function renewDue(organizationId) {
  const subscription = await renewExpiredSubscription(organizationId);
  const addons = await renewExpiredAddons(organizationId);
  return { subscription, addons };
}

// Cron: хугацаа нь дууссан бүх багц, автомат сунгалттай нэмэлт жагсаалтыг шалгана.
// Буцаах: { checked, renewed, addonsRenewed, failed }
export async function renewAllDue() {
  const now = new Date();
  const [subscriptions, addons] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      distinct: ["organizationId"],
      select: { organizationId: true },
    }),
    prisma.organizationAddon.findMany({
      where: { autoRenew: true, expiresAt: { lte: now } },
      distinct: ["organizationId"],
      select: { organizationId: true },
    }),
  ]);
  const organizations = new Set([...subscriptions, ...addons].map((row) => row.organizationId));
  const result = { checked: organizations.size, renewed: 0, addonsRenewed: 0, failed: 0 };
  for (const organizationId of organizations) {
    try {
      const renewed = await renewDue(organizationId);
      if (renewed.subscription) result.renewed++;
      result.addonsRenewed += renewed.addons.length;
    } catch (error) {
      console.error("[renewal]", organizationId, error.message);
      result.failed++;
    }
  }
  return result;
}
