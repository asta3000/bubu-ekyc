import { prisma } from "@/lib/prisma";
import { notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { operationSchema } from "@/lib/validations";

const NOT_FOUND = { notFound: "Үйл ажиллагаа олдсонгүй" };

export async function PATCH(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, operationSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  try {
    const operation = await prisma.operation.update({
      where: { id, ...notDeleted },
      data,
      select: { id: true },
    });
    return Response.json({ operation });
  } catch (err) {
    return prismaErrorResponse(err, NOT_FOUND);
  }
}

// Soft delete. Харьяалагдах байгууллагуудыг үйл ажиллагаанаас салгана.
export async function DELETE(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.$transaction([
      prisma.organization.updateMany({ where: { operationId: id }, data: { operationId: null } }),
      prisma.operation.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } }),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, NOT_FOUND);
  }
}
