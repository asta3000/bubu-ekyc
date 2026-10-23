import { prisma } from "@/lib/prisma";
import { fieldError, parseBody } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
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

  const pkg = await prisma.package.findFirst({
    where: { id: data.packageId, status: "ACTIVE" },
    select: { id: true, basePrice: true, durationDays: true },
  });
  if (!pkg) return fieldError("form", "Багц олдсонгүй", 404);

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
