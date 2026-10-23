import { prisma } from "@/lib/prisma";
import { notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { bankAccountSchema } from "@/lib/validations";

const ERRORS = { notFound: "Данс олдсонгүй" };

export async function PATCH(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, bankAccountSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  try {
    await prisma.bankAccount.update({ where: { id, ...notDeleted }, data });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, ERRORS);
  }
}

export async function DELETE(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.bankAccount.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, ERRORS);
  }
}
