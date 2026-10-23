import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { operationSchema } from "@/lib/validations";

export async function POST(request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, operationSchema);
  if (invalid) return invalid;

  const operation = await prisma.operation.create({ data, select: { id: true } });
  return Response.json({ operation }, { status: 201 });
}
