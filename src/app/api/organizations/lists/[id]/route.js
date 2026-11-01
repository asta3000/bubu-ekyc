import { prisma } from "@/lib/prisma";
import { notFound, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireOrgAdminApi } from "@/lib/organization-access";
import { findOwnList } from "@/lib/sanctions/custom-lists";
import { sanctionListSchema } from "@/lib/validations";
import { LIST_ERRORS } from "../shared";

// Жагсаалтын нэр, тайлбар, төлөвийг засна
export async function PATCH(request, ctx) {
  const { error, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, sanctionListSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  if (!(await findOwnList(organization.id, id))) return notFound(LIST_ERRORS.notFound);
  try {
    const list = await prisma.sanctionList.update({ where: { id }, data, select: { id: true } });
    return Response.json({ list });
  } catch (err) {
    return prismaErrorResponse(err, LIST_ERRORS);
  }
}

// Жагсаалтыг бичлэгүүдтэй нь устгана. Өмнөх тулгалтын үр дүнд хуулбар нь үлдэнэ.
export async function DELETE(request, ctx) {
  const { error, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  if (!(await findOwnList(organization.id, id))) return notFound(LIST_ERRORS.notFound);
  await prisma.sanctionList.delete({ where: { id } });
  return Response.json({ ok: true });
}
