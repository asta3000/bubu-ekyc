import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import OperationsManager from "./operations-manager";

export const metadata = { title: "Үйл ажиллагаа" };

const OperationsPage = async () => {
  await requireAdminPage();
  const operations = await prisma.operation.findMany({
    where: notDeleted,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { organizations: { where: notDeleted } } },
    },
  });

  return (
    <div className="space-y-6">
      <PageTitle title="Үйл ажиллагаа" description="Байгууллагуудыг ангилах үйл ажиллагааны чиглэл" />
      <OperationsManager operations={operations} />
    </div>
  );
};

export default OperationsPage;
