import { prisma } from "@/lib/prisma";
import { notDeleted, notFound, parseBody, prismaErrorResponse } from "@/lib/api";
import { addNewServicesToSubscriptions } from "@/lib/billing/subscriptions";
import { requireAdminApi } from "@/lib/session";
import { packageSchema } from "@/lib/validations";
import { PACKAGE_ERRORS } from "../shared";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Багц засна. Худалдаж авсан захиалгууд хуулбартай тул тоо, үнийн өөрчлөлт зөвхөн шинэ худалдан
// авалтад нөлөөлнө. Харин шинээр нэмсэн үйлчилгээ идэвхтэй захиалгуудад ч нэмэгдэнэ.
export async function PATCH(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, packageSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const exists = await prisma.package.findFirst({
    where: { id, ...notDeleted },
    include: { items: { select: { service: true, quota: true, unitPrice: true } } },
  });
  if (!exists) return notFound(PACKAGE_ERRORS.notFound);

  const { items, ...rest } = data;
  try {
    const added = await prisma.$transaction(async (tx) => {
      await tx.packageItem.deleteMany({ where: { packageId: id } });
      await tx.package.update({ where: { id }, data: { ...rest, items: { create: items } } });
      return addNewServicesToSubscriptions(tx, id, items);
    });
    await logAudit({
      action: "package.update",
      actor: session.user,
      organizationId: null,
      entity: { type: "Package", id },
      summary: `"${rest.name}" багцыг өөрчлөв`,
      changes: diffChanges(exists, data),
      metadata: { addedToSubscriptions: added },
    });
    return Response.json({ ok: true, addedToSubscriptions: added });
  } catch (err) {
    return prismaErrorResponse(err, PACKAGE_ERRORS);
  }
}

// Soft delete. Худалдаж авсан захиалгуудад нөлөөлөхгүй.
export async function DELETE(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    const { name } = await prisma.package.update({
      where: { id, ...notDeleted },
      data: { status: "DELETED" },
      select: { name: true },
    });
    await logAudit({
      action: "package.delete",
      actor: session.user,
      organizationId: null,
      entity: { type: "Package", id },
      summary: `"${name}" багцыг устгав`,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, PACKAGE_ERRORS);
  }
}
