import { prisma } from "@/lib/prisma";

// Байгууллагын хэтэвч. Өмнө нь үүсээгүй бол үүсгэнэ.
export const getWallet = (organizationId, db = prisma) =>
  db.wallet.upsert({ where: { organizationId }, update: {}, create: { organizationId } });

export class InsufficientFundsError extends Error {}

// Байгууллагын хэтэвчний мөрийг transaction дуустал түгжинэ. Нэг байгууллагын багц
// худалдан авах, идэвхжүүлэх үйлдлүүд ээлжилж (зэрэг биш) хийгдэнэ.
export async function lockWallet(tx, organizationId) {
  await getWallet(organizationId, tx);
  await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "organizationId" = ${organizationId} FOR UPDATE`;
}

// Хэтэвчинд мөнгө нэмэх/хасах ба гүйлгээг бүртгэх. Transaction (tx) дотор дуудна.
// amount < 0 үед үлдэгдэл хүрэлцэхгүй бол InsufficientFundsError (атомаар шалгана).
export async function changeBalance(tx, { organizationId, amount, type, description, paymentId, usageId, userId }) {
  const wallet = await getWallet(organizationId, tx);
  const { count } = await tx.wallet.updateMany({
    where: { id: wallet.id, ...(amount < 0 && { balance: { gte: -amount } }) },
    data: { balance: { increment: amount } },
  });
  if (!count) throw new InsufficientFundsError("Хэтэвчний үлдэгдэл хүрэлцэхгүй байна");

  const { balance } = await tx.wallet.findUnique({ where: { id: wallet.id }, select: { balance: true } });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type, amount, balanceAfter: balance, description, paymentId, usageId, userId },
  });
  return balance;
}
