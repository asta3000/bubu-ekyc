import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { serviceName } from "./services";
import { activeSubscription } from "./subscriptions";
import { InsufficientFundsError, changeBalance } from "./wallet";

// Үйлчилгээ ашиглах боломжгүй шалтгаан. code-оор client шийдвэр гаргана:
// NO_SUBSCRIPTION, SERVICE_NOT_INCLUDED, QUOTA_EXHAUSTED (баталгаажуулбал задгай үнээр),
// INSUFFICIENT_FUNDS
export class UsageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// API-ийн хариу. Төлбөр шаардлагатай тул 402.
export const usageErrorResponse = (error) =>
  Response.json({ error: error.message, code: error.code, ...error.details }, { status: 402 });

// Байгууллагын үйлчилгээ ашиглах эрхийн одоогийн байдал (хуудсанд харуулахад)
export async function serviceAllowance(organizationId, service) {
  const subscription = await activeSubscription(organizationId);
  const item = subscription?.items.find((i) => i.service === service);
  if (!subscription || !item) return { subscription: subscription ?? null, item: null };
  const includesQuota = subscription.basePrice > 0;
  return {
    subscription,
    item,
    remaining: includesQuota ? Math.max(0, item.quota - item.used) : 0,
    unitPrice: item.unitPrice,
  };
}

// Үйлчилгээг нэг удаа ашиглана. Суурь үнэтэй багцад эхлээд багцын тооноос хасна.
// Тоо дууссан бол payOverage=true үед л задгай үнээр хэтэвчнээс төлнө (хэрэглэгч
// баталгаажуулсны дараа). Суурь үнэ 0 бол бүх ашиглалт задгай үнээр шууд хэтэвчнээс.
// organizationId хоосон (байгууллагагүй админ) бол тооцоолохгүй, null буцаана.
export async function consumeService({ organizationId, service, userId, payOverage = false }) {
  if (!organizationId) return null;

  const subscription = await activeSubscription(organizationId);
  if (!subscription) {
    throw new UsageError("NO_SUBSCRIPTION", "Идэвхтэй багц байхгүй байна. \"Багц, төлбөр\" хэсгээс багц сонгоно уу.");
  }
  const item = subscription.items.find((i) => i.service === service);
  if (!item) {
    throw new UsageError("SERVICE_NOT_INCLUDED", `Таны багцад "${serviceName(service)}" үйлчилгээ ороогүй байна.`);
  }

  const base = { organizationId, subscriptionId: subscription.id, service, userId };
  return prisma.$transaction(async (tx) => {
    if (subscription.basePrice > 0) {
      // Зэрэг ирсэн хүсэлтүүд тоог хэтрүүлэхгүйн тулд нөхцөлтэйгөөр нэмнэ
      const { count } = await tx.subscriptionItem.updateMany({
        where: { id: item.id, used: { lt: item.quota } },
        data: { used: { increment: 1 } },
      });
      if (count) return tx.serviceUsage.create({ data: { ...base, charge: "QUOTA" } });

      if (!payOverage) {
        throw new UsageError(
          "QUOTA_EXHAUSTED",
          `Багцын "${serviceName(service)}" ашиглах тоо (${item.quota}) дууссан тул ашиглах боломжгүй. ` +
            (item.unitPrice > 0
              ? `Цааш ашиглавал нэг удаад ${formatMoney(item.unitPrice)} хэтэвчнээс төлөгдөнө.`
              : "Цааш үнэгүй ашиглах боломжтой."),
          { unitPrice: item.unitPrice },
        );
      }
    }

    const usage = await tx.serviceUsage.create({ data: { ...base, charge: "OVERAGE", amount: item.unitPrice } });
    if (item.unitPrice > 0) {
      try {
        await changeBalance(tx, {
          organizationId,
          amount: -item.unitPrice,
          type: "USAGE",
          description: `${serviceName(service)} (задгай үнээр)`,
          usageId: usage.id,
          userId,
        });
      } catch (error) {
        if (!(error instanceof InsufficientFundsError)) throw error;
        throw new UsageError(
          "INSUFFICIENT_FUNDS",
          `Хэтэвчний үлдэгдэл хүрэлцэхгүй байна. Нэг удаа ашиглахад ${formatMoney(item.unitPrice)} шаардлагатай. Хэтэвчээ цэнэглэнэ үү.`,
          { unitPrice: item.unitPrice },
        );
      }
    }
    return usage;
  });
}

// Ашиглалтыг холбогдох бичлэгтэй (Screening, IdentityVerification) холбоно
export async function attachUsage(usage, referenceId) {
  if (!usage) return;
  await prisma.serviceUsage.update({ where: { id: usage.id }, data: { referenceId } });
}

// Үйлчилгээ амжилтгүй болсон үед ашиглалтыг буцаана (тоо эсвэл мөнгийг)
export async function refundUsage(usage) {
  if (!usage) return;
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.serviceUsage.updateMany({
      where: { id: usage.id, refundedAt: null },
      data: { refundedAt: new Date() },
    });
    if (!count) return;
    if (usage.charge === "QUOTA") {
      await tx.subscriptionItem.updateMany({
        where: { subscriptionId: usage.subscriptionId, service: usage.service, used: { gt: 0 } },
        data: { used: { decrement: 1 } },
      });
    } else if (usage.amount > 0) {
      await changeBalance(tx, {
        organizationId: usage.organizationId,
        amount: usage.amount,
        type: "REFUND",
        description: `${serviceName(usage.service)} амжилтгүй болсон тул буцаав`,
        usageId: usage.id,
        userId: usage.userId,
      });
    }
  });
}
