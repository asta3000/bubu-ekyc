import { prisma } from "@/lib/prisma";
import { notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { couponSchema } from "@/lib/validations";
import { COUPON_ERRORS, checkCouponOrganization } from "../shared";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Купон засна. Код хоосон бол хуучнаараа үлдэнэ.
export async function PATCH(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, couponSchema);
  if (invalid) return invalid;
  const organizationError = await checkCouponOrganization(data.organizationId);
  if (organizationError) return organizationError;

  const { id } = await ctx.params;
  const { code, ...rest } = data;
  const before = await prisma.coupon.findUnique({ where: { id } });
  try {
    const coupon = await prisma.coupon.update({
      where: { id, ...notDeleted },
      data: code ? { ...rest, code } : rest,
      select: { id: true },
    });
    const after = code ? { ...rest, code } : rest;
    await logAudit({
      action: "coupon.update",
      actor: session.user,
      organizationId: null,
      entity: { type: "Coupon", id },
      summary: `"${code ?? before?.code}" купоныг өөрчлөв`,
      changes: diffChanges(before, after),
    });
    return Response.json({ coupon });
  } catch (err) {
    return prismaErrorResponse(err, COUPON_ERRORS);
  }
}

// Soft delete. Ашиглагдсан түүхтэй байж болох тул устгахгүй.
export async function DELETE(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    const { code } = await prisma.coupon.update({
      where: { id, ...notDeleted },
      data: { status: "DELETED" },
      select: { code: true },
    });
    await logAudit({
      action: "coupon.delete",
      actor: session.user,
      organizationId: null,
      entity: { type: "Coupon", id },
      summary: `"${code}" купоныг устгав`,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, COUPON_ERRORS);
  }
}
