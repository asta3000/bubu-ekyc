import { prisma } from "@/lib/prisma";
import { requireOrgAdminPage } from "@/lib/organization-access";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import ListsManager from "./lists-manager";

export const metadata = { title: "Өөрийн жагсаалт" };

const PAGE = {
  title: "Өөрийн хоригийн жагсаалт",
  description:
    "Байгууллагынхаа дотоод жагсаалтыг (хар жагсаалт, өндөр эрсдэлтэй харилцагч г.м.) үүсгэж удирдана. Идэвхтэй жагсаалтууд хориг тулгахад нэмэлт жагсаалт болж орно. Зөвхөн байгууллагын админ харж, засна.",
};

const ListsPage = async () => {
  const { organization, accessError } = await requireOrgAdminPage();
  if (accessError) return <AccessDenied {...PAGE} error={accessError} />;

  const lists = await prisma.sanctionList.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { entries: true } },
    },
  });

  return (
    <>
      <PageTitle {...PAGE} />
      <ListsManager lists={lists} />
    </>
  );
};

export default ListsPage;
