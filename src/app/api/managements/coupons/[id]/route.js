import { prisma } from "@/lib/prisma";
import { notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { couponSchema } from "@/lib/validations";
import { COUPON_ERRORS, checkCouponOrganization } from "../shared";

// Купон засна. Код хоосон бол хуучнаараа үлдэнэ.
export async function PATCH(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, couponSchema);
  if (invalid) return invalid;
  const organizationError = await checkCouponOrganization(data.organizationId);
  if (organizationError) return organizationError;

  const { id } = await ctx.params;
  const { code, ...rest } = data;
  try {
    const coupon = await prisma.coupon.update({
      where: { id, ...notDeleted },
      data: code ? { ...rest, code } : rest,
      select: { id: true },
    });
    return Response.json({ coupon });
  } catch (err) {
    return prismaErrorResponse(err, COUPON_ERRORS);
  }
}

// Soft delete. Ашиглагдсан түүхтэй байж болох тул устгахгүй.
export async function DELETE(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.coupon.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, COUPON_ERRORS);
  }
}
