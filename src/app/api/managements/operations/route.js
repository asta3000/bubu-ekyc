import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { operationSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

export async function POST(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, operationSchema);
  if (invalid) return invalid;

  const operation = await prisma.operation.create({ data, select: { id: true } });
  await logAudit({
    action: "operation.create",
    actor: session.user,
    organizationId: null,
    entity: { type: "Operation", id: operation.id },
    summary: `"${data.name}" үйл ажиллагаа үүсгэв`,
  });
  return Response.json({ operation }, { status: 201 });
}
