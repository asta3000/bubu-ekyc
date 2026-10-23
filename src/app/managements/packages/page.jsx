import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import PackagesManager from "./packages-manager";

export const metadata = { title: "Багц" };

const PackagesPage = async () => {
  await requireAdminPage();
  const packages = await prisma.package.findMany({
    where: notDeleted,
    orderBy: [{ basePrice: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      durationDays: true,
      status: true,
      items: { select: { service: true, quota: true, unitPrice: true } },
      // Хугацаа нь дууссан ч ACTIVE төлөвтэй үлдсэнийг тоолохгүй
      _count: {
        select: {
          subscriptions: {
            where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="Багц"
        description="Байгууллагууд худалдаж авах үйлчилгээний багц. Үнийн өөрчлөлт зөвхөн шинэ худалдан авалтад нөлөөлнө."
      />
      <PackagesManager packages={packages} />
    </div>
  );
};

export default PackagesPage;
