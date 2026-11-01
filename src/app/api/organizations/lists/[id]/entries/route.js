import { prisma } from "@/lib/prisma";
import { notFound, parseBody } from "@/lib/api";
import { requireOrgAdminApi } from "@/lib/organization-access";
import { findOwnList, newEntryKeys, toEntryData } from "@/lib/sanctions/custom-lists";
import { sanctionListEntrySchema } from "@/lib/validations";
import { LIST_ERRORS } from "../../shared";

// Жагсаалтад бичлэг нэмнэ
export async function POST(request, ctx) {
  const { error, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, sanctionListEntrySchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const list = await findOwnList(organization.id, id);
  if (!list) return notFound(LIST_ERRORS.notFound);

  const entry = await prisma.sanctionEntry.create({
    data: { ...newEntryKeys(list.id), ...toEntryData(data), listedAt: new Date() },
    select: { id: true },
  });
  // Жагсаалтын "шинэчлэгдсэн" огноо (тулгах хуудсанд харагдана)
  await prisma.sanctionList.update({ where: { id: list.id }, data: { updatedAt: new Date() } });
  return Response.json({ entry }, { status: 201 });
}
