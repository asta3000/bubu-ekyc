import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { includesQuota, serviceName } from "./services";
import { awaitingRenewal, renewDue } from "./renewals";
import { activeSubscription } from "./subscriptions";
import { InsufficientFundsError, changeBalance } from "./wallet";

// Үйлчилгээ ашиглах боломжгүй шалтгаан. code-оор client шийдвэр гаргана:
// NO_SUBSCRIPTION, SERVICE_NOT_INCLUDED, QUOTA_EXHAUSTED (баталгаажуулбал задгай үнээр),
// QUOTA_LIMIT (тоо дууссан, задгай үнэгүй тул цааш ашиглахгүй), INSUFFICIENT_FUNDS
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
  await renewDue(organizationId);
  const subscription = await activeSubscription(organizationId);
  const item = subscription?.items.find((i) => i.service === service);
  if (!subscription || !item) return { subscription: subscription ?? null, item: null };
  return {
    subscription,
    item,
    remaining: includesQuota(subscription.basePrice, item.quota) ? Math.max(0, item.quota - item.used) : 0,
    unitPrice: item.unitPrice,
  };
}

// Үйлчилгээг нэг удаа ашиглана. Суурь үнэтэй эсвэл тоо оруулсан үйлчилгээнд эхлээд
// багцын тооноос хасна. Тоо дууссан бол payOverage=true үед л задгай үнээр хэтэвчнээс
// төлнө (хэрэглэгч баталгаажуулсны дараа). Задгай үнэ 0 бол тоо дууссаны дараа ашиглуулахгүй.
// Суурь үнэ 0, тоо 0 бол шууд задгай үнээр.
// organizationId хоосон (байгууллагагүй админ) бол тооцоолохгүй, null буцаана.
export async function consumeService({ organizationId, service, userId, payOverage = false }) {
  if (!organizationId) return null;

  // Хугацаа нь дууссан багцыг хэтэвчнээс сунгах боломжтой бол эхлээд сунгана
  await renewDue(organizationId);
  const subscription = await activeSubscription(organizationId);
  if (!subscription) {
    const awaiting = (await awaitingRenewal(organizationId))?.subscription;
    throw new UsageError(
      "NO_SUBSCRIPTION",
      awaiting
        ? `"${awaiting.packageName}" багцын хугацаа дууссан бөгөөд хэтэвчний үлдэгдэл хүрэлцээгүй тул сунгагдсангүй. Хэтэвчинд ${formatMoney(awaiting.price)}-өөс доошгүй болтол цэнэглэхэд автоматаар сунгагдана.`
        : "Идэвхтэй багц байхгүй байна. \"Багц, төлбөр\" хэсгээс багц сонгоно уу.",
    );
  }
  const item = subscription.items.find((i) => i.service === service);
  if (!item) {
    throw new UsageError("SERVICE_NOT_INCLUDED", `Таны багцад "${serviceName(service)}" үйлчилгээ ороогүй байна.`);
  }

  const base = { organizationId, subscriptionId: subscription.id, service, userId };
  return prisma.$transaction(async (tx) => {
    if (includesQuota(subscription.basePrice, item.quota)) {
      // Зэрэг ирсэн хүсэлтүүд тоог хэтрүүлэхгүйн тулд нөхцөлтэйгөөр нэмнэ
      const { count } = await tx.subscriptionItem.updateMany({
        where: { id: item.id, used: { lt: item.quota } },
        data: { used: { increment: 1 } },
      });
      if (count) return tx.serviceUsage.create({ data: { ...base, charge: "QUOTA" } });

      if (item.unitPrice === 0) {
        throw new UsageError(
          "QUOTA_LIMIT",
          `Багцын "${serviceName(service)}" ашиглах тоо (${item.quota}) дууссан. ` +
            "Цааш ашиглахын тулд \"Багц, төлбөр\" хэсгээс багцаа сунгах эсвэл шинэ багц сонгоно уу.",
        );
      }
      if (!payOverage) {
        throw new UsageError(
          "QUOTA_EXHAUSTED",
          `Багцын "${serviceName(service)}" ашиглах тоо (${item.quota}) дууссан тул ашиглах боломжгүй. ` +
            `Цааш ашиглавал нэг удаад ${formatMoney(item.unitPrice)} хэтэвчнээс төлөгдөнө.`,
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
