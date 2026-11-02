import { prisma } from "@/lib/prisma";
import { lockWallet } from "./wallet";

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
  await tx.subscription.updateMany({
    where: { organizationId: subscription.organizationId, status: "ACTIVE" },
    data: { status: "ENDED", expiresAt: now },
  });
  return tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      startsAt: now,
      expiresAt: subscription.durationDays
        ? new Date(now.getTime() + subscription.durationDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });
}
