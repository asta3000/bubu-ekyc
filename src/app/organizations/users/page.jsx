import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { requireOrgAdminPage } from "@/lib/organization-access";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import OrgUsersManager from "./org-users-manager";

export const metadata = { title: "Хэрэглэгчид" };

const PAGE = {
  title: "Хэрэглэгчид",
  description:
    "Байгууллагын хэрэглэгчдийн эрх, төлөвийг өөрчилж, нууц үгийг шинээр тохируулна. Идэвхгүй болгосон хэрэглэгч нэвтрэх боломжгүй.",
};

// Байгууллагын админд: өөрийн байгууллагын хэрэглэгчид (системийн ADMIN харагдахгүй)
const OrganizationUsersPage = async () => {
  const { session, organization, accessError } = await requireOrgAdminPage();
  if (accessError) return <AccessDenied {...PAGE} error={accessError} />;

  const users = await prisma.user.findMany({
    where: { organizationId: organization.id, role: { not: "ADMIN" }, ...notDeleted },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      contact: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageTitle {...PAGE} />
      <OrgUsersManager users={users} currentUserId={session.user.id} />
    </div>
  );
};

export default OrganizationUsersPage;
