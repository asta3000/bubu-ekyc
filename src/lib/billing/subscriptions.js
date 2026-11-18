import { prisma } from "@/lib/prisma";
import { requiresContract } from "./services";
import { lockWallet, releaseFunds } from "./wallet";

// Одоо хүчинтэй багц (ACTIVE, хугацаа дуусаагүй) үйлчилгээнүүдтэйгээ
export const activeSubscription = (organizationId, db = prisma) =>
  db.subscription.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { startsAt: "desc" },
    include: { items: true },
  });

// Багцаас захиалга (PENDING) үүсгэнэ. Үнэ, тоог хуулбарлан хадгална.
// extraDays: хугацаа сунгах купоноор нэмэгдэх хоног
export const createSubscription = (pkg, organizationId, db = prisma, { extraDays = 0 } = {}) =>
  db.subscription.create({
    data: {
      organizationId,
      packageId: pkg.id,
      packageName: pkg.name,
      basePrice: pkg.basePrice,
      durationDays: pkg.durationDays ? pkg.durationDays + extraDays : null,
      // packageOffer(..., "year")-аас ирсэн жилийн нөхцөл: сар бүр тоо шинэчлэгдэнэ
      annual: Boolean(pkg.annual),
      periodDays: pkg.annual ? pkg.periodDays : null,
      items: {
        create: pkg.items.map(({ service, quota, unitPrice }) => ({ service, quota, unitPrice })),
      },
    },
    include: { items: true },
  });

// Багцад шинээр нэмсэн үйлчилгээг тухайн багцын идэвхтэй захиалгуудад нэмнэ. Захиалгад
// аль хэдийн байгаа үйлчилгээний тоо, үнэ худалдан авах үеийн хуулбараараа үлдэнэ.
// Буцаах: нэмсэн мөрийн тоо
export async function addNewServicesToSubscriptions(db, packageId, items) {
  const subscriptions = await db.subscription.findMany({
    where: { packageId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!subscriptions.length || !items.length) return 0;
  // (subscriptionId, service) unique тул байгаа үйлчилгээг алгасна
  const { count } = await db.subscriptionItem.createMany({
    data: subscriptions.flatMap(({ id }) =>
      items.map(({ service, quota, unitPrice }) => ({ subscriptionId: id, service, quota, unitPrice })),
    ),
    skipDuplicates: true,
  });
  return count;
}

// Захиалгыг идэвхжүүлнэ. Байгууллагын өмнөх идэвхтэй багц дуусна (нэг л идэвхтэй багц).
// Өмнөх багцын үлдсэн тоо шинэ багцад шилжихгүй (ахиулах, сунгах аль алинд).
// Transaction (tx) дотор дуудна.
export async function activateSubscription(tx, subscriptionId) {
  const pending = await tx.subscription.findUnique({ where: { id: subscriptionId }, select: { organizationId: true } });
  if (!pending) return null;
  // Зэрэг идэвхжүүлэлт хоёр идэвхтэй багц үүсгэхээс сэргийлнэ
  await lockWallet(tx, pending.organizationId);

  const subscription = await tx.subscription.findUnique({ where: { id: subscriptionId } });
  if (subscription.status !== "PENDING") return subscription;

  const now = new Date();
  // Солигдож буй багцын хүлээгдэж буй ахиулах захиалгыг цуцалж, барьсан мөнгийг буцаана
  await cancelPendingUpgrades(tx, subscription.organizationId, "Өөр багц идэвхжсэн тул ахиулах захиалга цуцлагдав");
  await tx.subscription.updateMany({
    where: { organizationId: subscription.organizationId, status: "ACTIVE" },
    data: { status: "ENDED", expiresAt: now },
  });
  return tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      startsAt: now,
      periodStartsAt: subscription.annual ? now : null,
      expiresAt: subscription.durationDays
        ? new Date(now.getTime() + subscription.durationDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });
}

// Гэрээ шаардахгүй, суурь үнэ нь хамгийн бага идэвхтэй багц (гэрээгүй байгууллагын багц)
export const starterPackage = (db = prisma) =>
  db.package.findFirst({
    where: { status: "ACTIVE", contractRequired: false },
    orderBy: [{ basePrice: "asc" }, { createdAt: "asc" }],
    include: { items: true },
  });

// Шинээр үүссэн байгууллагад гэрээ шаардахгүй хамгийн хямд багцыг төлбөргүйгээр шууд
// идэвхжүүлнэ (гэрээгүй байгууллага хэтэвчээ цэнэглэх боломжгүй тул). Ийм багц байхгүй бол
// юу ч хийхгүй. Transaction (tx) дотор дуудна. Буцаах: идэвхжсэн захиалга эсвэл null
export async function grantStarterSubscription(tx, organizationId) {
  const pkg = await starterPackage(tx);
  if (!pkg) return null;
  const subscription = await createSubscription(pkg, organizationId, tx);
  return activateSubscription(tx, subscription.id);
}

// Гэрээ байгуулаагүй байгууллага зөвхөн гэрээ шаардахгүй багц идэвхжүүлнэ
export const contractBlocks = (pkg, organization) => requiresContract(pkg) && !organization?.contractSigned;

export const CONTRACT_REQUIRED_MESSAGE = "Гэрээ байгуулаагүй байгууллага энэ боломжийг ашиглах боломжгүй. Админтай холбогдож гэрээ байгуулна уу.";

// Байгууллагын идэвхтэй багцад багтсан үйлчилгээнүүд (цэс харуулахад). Багцгүй бол хоосон.
export async function subscribedServices(organizationId) {
  const subscription = await activeSubscription(organizationId);
  return subscription?.items.map((item) => item.service) ?? [];
}

// Байгууллагын хүлээгдэж буй ахиулах захиалгуудыг цуцалж барьсан дүнг үлдэгдэлд буцаана.
// Transaction (tx) дотор, хэтэвч түгжигдсэн үед дуудна. Буцаах: цуцалсан тоо
export async function cancelPendingUpgrades(tx, organizationId, description, { userId = null, subscriptionId } = {}) {
  const pending = await tx.packageUpgrade.findMany({
    where: { organizationId, status: "PENDING", ...(subscriptionId && { subscriptionId }) },
  });
  for (const upgrade of pending) {
    await tx.packageUpgrade.update({ where: { id: upgrade.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (upgrade.amount > 0) await releaseFunds(tx, { organizationId, amount: upgrade.amount, description, userId });
  }
  return pending.length;
}
