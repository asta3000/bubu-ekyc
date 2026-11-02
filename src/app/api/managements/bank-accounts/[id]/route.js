import { prisma } from "@/lib/prisma";
import { notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { bankAccountSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

const ERRORS = { notFound: "Данс олдсонгүй" };

export async function PATCH(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, bankAccountSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const before = await prisma.bankAccount.findUnique({ where: { id } });
  try {
    await prisma.bankAccount.update({ where: { id, ...notDeleted }, data });
    await logAudit({
      action: "bank_account.update",
      actor: session.user,
      organizationId: null,
      entity: { type: "BankAccount", id },
      summary: "Банкны дансыг өөрчлөв",
      changes: diffChanges(before, data),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, ERRORS);
  }
}

export async function DELETE(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.bankAccount.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } });
    await logAudit({
      action: "bank_account.delete",
      actor: session.user,
      organizationId: null,
      entity: { type: "BankAccount", id },
      summary: "Банкны дансыг устгав",
    });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, ERRORS);
  }
}
