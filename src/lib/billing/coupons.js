import { prisma } from "@/lib/prisma";
import { couponState } from "@/lib/coupons";
import { formatDate } from "@/lib/format";

export class CouponError extends Error {}

const STATE_ERRORS = {
  INACTIVE: () => "Купон идэвхгүй байна",
  SCHEDULED: (coupon) => `Купон ${formatDate(coupon.startsAt)}-нээс хүчинтэй болно`,
  EXPIRED: () => "Купоны хугацаа дууссан байна",
  EXHAUSTED: () => "Купоны ашиглах тоо дууссан байна",
};

// Купоныг багцад хэрэглэх боломжтой эсэхийг шалгаж үр дүнг тооцно. Хэрэглэх боломжгүй бол
// CouponError. Буцаах: { coupon, discountAmount, extraDays, finalPrice }
export async function evaluateCoupon(db, { code, organizationId, pkg }) {
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || coupon.status === "DELETED") throw new CouponError("Купон олдсонгүй");

  const state = couponState(coupon);
  if (state !== "ACTIVE") throw new CouponError(STATE_ERRORS[state](coupon));
  if (coupon.organizationId && coupon.organizationId !== organizationId) {
    throw new CouponError("Энэ купон танай байгууллагад хамаарахгүй");
  }
  const redeemed = await db.couponRedemption.findUnique({
    where: { couponId_organizationId: { couponId: coupon.id, organizationId } },
    select: { id: true },
  });
  if (redeemed) throw new CouponError("Танай байгууллага энэ купоныг ашигласан байна");

  if (coupon.discountType === "EXTEND_DAYS") {
    if (!pkg.durationDays) throw new CouponError("Хугацаагүй багцад хугацаа сунгах купон хэрэглэх боломжгүй");
    return { coupon, discountAmount: 0, extraDays: coupon.discountValue, finalPrice: pkg.basePrice };
  }

  if (pkg.basePrice === 0) throw new CouponError("Үнэгүй багцад хямдралын купон хэрэглэх боломжгүй");
  const discountAmount =
    coupon.discountType === "PERCENT"
      ? Math.round((pkg.basePrice * coupon.discountValue) / 100)
      : Math.min(coupon.discountValue, pkg.basePrice);
  return { coupon, discountAmount, extraDays: 0, finalPrice: pkg.basePrice - discountAmount };
}

// Купоныг ашигласанд тооцно (transaction дотор). Нийт ашиглах тоог атомаар шалгана;
// нэг байгууллага нэг купоныг нэг л удаа (CouponRedemption-ийн unique) ашиглана.
export async function redeemCoupon(tx, evaluation, { organizationId, subscriptionId, paymentId = null }) {
  const { coupon, discountAmount, extraDays } = evaluation;
  const { count } = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      status: "ACTIVE",
      OR: [{ usageLimit: null }, { usedCount: { lt: prisma.coupon.fields.usageLimit } }],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (!count) throw new CouponError(STATE_ERRORS.EXHAUSTED());

  try {
    await tx.couponRedemption.create({
      data: { couponId: coupon.id, organizationId, subscriptionId, paymentId, discountAmount, extraDays },
    });
  } catch (error) {
    if (error?.code === "P2002") throw new CouponError("Танай байгууллага энэ купоныг ашигласан байна");
    throw error;
  }
}

// Төлбөр цуцлагдвал (эсвэл татгалзвал) тухайн төлбөрт ашигласан купоныг чөлөөлнө
export async function releaseCoupon(tx, paymentId) {
  const redemption = await tx.couponRedemption.findUnique({ where: { paymentId }, select: { id: true, couponId: true } });
  if (!redemption) return;
  await tx.couponRedemption.delete({ where: { id: redemption.id } });
  await tx.coupon.updateMany({
    where: { id: redemption.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}
