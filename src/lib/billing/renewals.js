import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit/log";
import { formatMoney } from "@/lib/format";
import { LOCKED_TRANSACTION, hasPendingPurchase, uniqueReference } from "./payments";
import { activateSubscription, activeSubscription, createSubscription } from "./subscriptions";
import { changeBalance, getWallet, lockWallet } from "./wallet";

// Хугацаа дууссанаас хойш энэ хугацаанд л автоматаар сунгана. Удаан хугацаанд анзаараагүй
// (жишээ нь энэ боломж нэмэгдэхээс өмнө дууссан) багцыг гэнэт төлүүлэхгүй.
const RENEWAL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// Хугацаа нь дууссан идэвхтэй багцыг тухайн багцын одоогийн үнээр хэтэвчнээс сунгана.
// Багц идэвхгүй болсон, үлдэгдэл хүрэлцэхгүй, өөр багцын төлбөр хүлээгдэж буй бол
// сунгахгүй, зөвхөн дуусгана (дахин оролдохгүй). Өмнөх багцын үлдсэн тоо шилжихгүй.
// Буцаах: шинэ захиалга эсвэл null
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
    await tx.subscription.update({ where: { id: previous.id }, data: { status: "ENDED" } });

    if (await activeSubscription(organizationId, tx)) return null;
    if (now - previous.expiresAt > RENEWAL_WINDOW_MS) return null;
    if (await hasPendingPurchase(tx, organizationId)) return null;
    const pkg = previous.packageId
      ? await tx.package.findFirst({ where: { id: previous.packageId, status: "ACTIVE" }, include: { items: true } })
      : null;
    if (!pkg) return null;
    const wallet = await getWallet(organizationId, tx);
    if (wallet.balance < pkg.basePrice) return null;

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

// Cron: хугацаа нь дууссан бүх идэвхтэй багцыг шалгана. Буцаах: { renewed, ended }
export async function renewExpiredSubscriptions() {
  const organizations = await prisma.subscription.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
    distinct: ["organizationId"],
    select: { organizationId: true },
  });
  const result = { renewed: 0, ended: 0, failed: 0 };
  for (const { organizationId } of organizations) {
    try {
      (await renewExpiredSubscription(organizationId)) ? result.renewed++ : result.ended++;
    } catch (error) {
      console.error("[renewal]", organizationId, error.message);
      result.failed++;
    }
  }
  return result;
}
