import { prisma } from "@/lib/prisma";
import { fieldError, parseBody } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { packageOffer } from "@/lib/billing/annual-plan";
import { CouponError, evaluateCoupon } from "@/lib/billing/coupons";
import { couponBenefit } from "@/lib/billing/labels";
import { couponPreviewSchema } from "@/lib/validations";

// Худалдан авахаас өмнө купоныг шалгаж, төлөх дүн / нэмэгдэх хоногийг урьдчилан харуулна.
// Купоныг энд ашигласанд тооцохгүй (худалдан авалтын үед дахин шалгана).
export async function POST(request) {
  const { error, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, couponPreviewSchema);
  if (invalid) return invalid;

  const base = await prisma.package.findFirst({
    where: { id: data.packageId, status: "ACTIVE" },
    select: { id: true, basePrice: true, durationDays: true, items: true },
  });
  if (!base) return fieldError("form", "Багц олдсонгүй", 404);
  // Жилээр авах бол купоныг жилийн үнэ, хугацаанд хэрэглэнэ
  const pkg = await packageOffer(base, data.period);
  if (!pkg) return fieldError("form", "Энэ багцыг жилээр авах боломжгүй");

  try {
    const result = await evaluateCoupon(prisma, { code: data.couponCode, organizationId: organization.id, pkg });
    return Response.json({
      code: result.coupon.code,
      benefit: couponBenefit(result.coupon),
      discountAmount: result.discountAmount,
      extraDays: result.extraDays,
      finalPrice: result.finalPrice,
      durationDays: pkg.durationDays ? pkg.durationDays + result.extraDays : null,
    });
  } catch (err) {
    if (err instanceof CouponError) return fieldError("couponCode", err.message);
    throw err;
  }
}
