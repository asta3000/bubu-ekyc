import { prisma } from "@/lib/prisma";
import { notDeleted, parseBody } from "@/lib/api";
import { MAX_BANK_ACCOUNTS } from "@/lib/billing/bank-accounts";
import { requireAdminApi } from "@/lib/session";
import { bankAccountSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

export async function POST(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, bankAccountSchema);
  if (invalid) return invalid;

  if ((await prisma.bankAccount.count({ where: notDeleted })) >= MAX_BANK_ACCOUNTS) {
    return Response.json({ error: `Хамгийн ихдээ ${MAX_BANK_ACCOUNTS} данс бүртгэнэ` }, { status: 400 });
  }
  const account = await prisma.bankAccount.create({ data, select: { id: true } });
  await logAudit({
    action: "bank_account.create",
    actor: session.user,
    organizationId: null,
    entity: { type: "BankAccount", id: account.id },
    summary: "Банкны данс нэмэв",
    metadata: data,
  });
  return Response.json({ account }, { status: 201 });
}
