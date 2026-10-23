import { prisma } from "@/lib/prisma";
import { uniqueCode } from "@/lib/codes";

// Тохиргооны төлөв дээр хугацаа, ашиглалтыг нэмж бодит төлөвийг гаргана:
// ACTIVE | INACTIVE | SCHEDULED | EXPIRED | EXHAUSTED
export function couponState(coupon, now = new Date()) {
  if (coupon.status !== "ACTIVE") return coupon.status;
  if (coupon.startsAt && coupon.startsAt > now) return "SCHEDULED";
  if (coupon.expiresAt && coupon.expiresAt < now) return "EXPIRED";
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return "EXHAUSTED";
  return "ACTIVE";
}

// Давхардаагүй купон код
export const uniqueCouponCode = () =>
  uniqueCode(async (code) => Boolean(await prisma.coupon.findUnique({ where: { code }, select: { id: true } })));
