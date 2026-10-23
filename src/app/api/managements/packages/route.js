import { prisma } from "@/lib/prisma";
import { parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { packageSchema } from "@/lib/validations";
import { PACKAGE_ERRORS } from "./shared";

export async function POST(request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, packageSchema);
  if (invalid) return invalid;

  const { items, ...rest } = data;
  try {
    const pkg = await prisma.package.create({
      data: { ...rest, items: { create: items } },
      select: { id: true },
    });
    return Response.json({ package: pkg }, { status: 201 });
  } catch (err) {
    return prismaErrorResponse(err, PACKAGE_ERRORS);
  }
}
