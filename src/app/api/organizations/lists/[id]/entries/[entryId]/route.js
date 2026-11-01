import { prisma } from "@/lib/prisma";
import { notFound, parseBody } from "@/lib/api";
import { requireOrgAdminApi } from "@/lib/organization-access";
import { toEntryData } from "@/lib/sanctions/custom-lists";
import { sanctionListEntrySchema } from "@/lib/validations";
import { ENTRY_ERRORS } from "../../../shared";

// Бичлэг өөрийн байгууллагын жагсаалтад байгаа эсэх
const findOwnEntry = async (organization, ctx) => {
  const { id, entryId } = await ctx.params;
  return prisma.sanctionEntry.findFirst({
    where: { id: entryId, listId: id, list: { organizationId: organization.id } },
    select: { id: true, listId: true },
  });
};

const touchList = (listId) => prisma.sanctionList.update({ where: { id: listId }, data: { updatedAt: new Date() } });

export async function PATCH(request, ctx) {
  const { error, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, sanctionListEntrySchema);
  if (invalid) return invalid;

  const entry = await findOwnEntry(organization, ctx);
  if (!entry) return notFound(ENTRY_ERRORS.notFound);
  await prisma.sanctionEntry.update({ where: { id: entry.id }, data: toEntryData(data) });
  await touchList(entry.listId);
  return Response.json({ entry: { id: entry.id } });
}

export async function DELETE(request, ctx) {
  const { error, organization } = await requireOrgAdminApi();
  if (error) return error;

  const entry = await findOwnEntry(organization, ctx);
  if (!entry) return notFound(ENTRY_ERRORS.notFound);
  await prisma.sanctionEntry.delete({ where: { id: entry.id } });
  await touchList(entry.listId);
  return Response.json({ ok: true });
}
