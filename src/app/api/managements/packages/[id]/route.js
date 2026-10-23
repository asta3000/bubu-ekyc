import { prisma } from "@/lib/prisma";
import { notDeleted, notFound, parseBody, prismaErrorResponse } from "@/lib/api";
import { addNewServicesToSubscriptions } from "@/lib/billing/subscriptions";
import { requireAdminApi } from "@/lib/session";
import { packageSchema } from "@/lib/validations";
import { PACKAGE_ERRORS } from "../shared";

// Багц засна. Худалдаж авсан захиалгууд хуулбартай тул тоо, үнийн өөрчлөлт зөвхөн шинэ худалдан
// авалтад нөлөөлнө. Харин шинээр нэмсэн үйлчилгээ идэвхтэй захиалгуудад ч нэмэгдэнэ.
export async function PATCH(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, packageSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const exists = await prisma.package.findFirst({ where: { id, ...notDeleted }, select: { id: true } });
  if (!exists) return notFound(PACKAGE_ERRORS.notFound);

  const { items, ...rest } = data;
  try {
    const added = await prisma.$transaction(async (tx) => {
      await tx.packageItem.deleteMany({ where: { packageId: id } });
      await tx.package.update({ where: { id }, data: { ...rest, items: { create: items } } });
      return addNewServicesToSubscriptions(tx, id, items);
    });
    return Response.json({ ok: true, addedToSubscriptions: added });
  } catch (err) {
    return prismaErrorResponse(err, PACKAGE_ERRORS);
  }
}

// Soft delete. Худалдаж авсан захиалгуудад нөлөөлөхгүй.
export async function DELETE(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.package.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, PACKAGE_ERRORS);
  }
}
