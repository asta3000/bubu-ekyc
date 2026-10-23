import { prisma } from "@/lib/prisma";
import { parseBody, prismaErrorResponse } from "@/lib/api";
import { uniqueCouponCode } from "@/lib/coupons";
import { requireAdminApi } from "@/lib/session";
import { couponSchema } from "@/lib/validations";
import { COUPON_ERRORS, checkCouponOrganization } from "./shared";

// Купон үүсгэнэ. Код оруулаагүй бол автоматаар үүсгэнэ.
export async function POST(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, couponSchema);
  if (invalid) return invalid;
  const organizationError = await checkCouponOrganization(data.organizationId);
  if (organizationError) return organizationError;

  try {
    const coupon = await prisma.coupon.create({
      data: { ...data, code: data.code ?? (await uniqueCouponCode()), createdById: session.user.id },
      select: { id: true, code: true },
    });
    return Response.json({ coupon }, { status: 201 });
  } catch (err) {
    return prismaErrorResponse(err, COUPON_ERRORS);
  }
}
