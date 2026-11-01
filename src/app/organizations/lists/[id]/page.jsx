import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgAdminPage } from "@/lib/organization-access";
import { toFormValues } from "@/lib/sanctions/custom-lists";
import { countryOptions } from "@/lib/screening/countries";
import { TextLink } from "@/components/Links";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import { STATUS_LABELS } from "@/lib/labels";
import EntriesManager from "./entries-manager";

export const metadata = { title: "Өөрийн жагсаалт" };

const ListPage = async ({ params }) => {
  const { organization, accessError } = await requireOrgAdminPage();
  if (accessError) return <AccessDenied error={accessError} />;

  const { id } = await params;
  const list = await prisma.sanctionList.findFirst({
    where: { id, organizationId: organization.id },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      entries: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!list) notFound();

  const description = [list.description, list.status === "ACTIVE" ? null : `${STATUS_LABELS[list.status]}: тулгалтад орохгүй`]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <TextLink href="/organizations/lists">← Жагсаалтууд</TextLink>
      <PageTitle title={list.name} description={description} />
      <EntriesManager
        listId={list.id}
        entries={list.entries.map((entry) => ({
          ...toFormValues(entry),
          display: { nationalities: entry.nationalities, createdAt: entry.createdAt },
        }))}
        countries={countryOptions()}
      />
    </>
  );
};

export default ListPage;
