import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import UsersManager from "./users-manager";

export const metadata = { title: "Хэрэглэгч" };

const UsersPage = async () => {
  const session = await requireAdminPage();
  const [users, organizations] = await Promise.all([
    prisma.user.findMany({
      where: notDeleted,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        organizationId: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.organization.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Хэрэглэгч" description="Хэрэглэгчийн байгууллага, эрх, төлөв" />
      <UsersManager users={users} organizations={organizations} currentUserId={session.user.id} />
    </div>
  );
};

export default UsersPage;
