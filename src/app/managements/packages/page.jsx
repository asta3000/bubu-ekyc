import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { requireAdminPage } from "@/lib/session";
import { ADDON_SOURCES } from "@/lib/sanctions/sources";
import { PageTitle } from "@/components/Titles";
import AddonsManager from "./addons-manager";
import PackagesManager from "./packages-manager";

export const metadata = { title: "Багц" };

// Нэмэлт жагсаалт бүрийн тохиргоо, одоо идэвхтэй байгууллагын тоо
async function addonRows() {
  const [settings, active] = await Promise.all([
    prisma.sourceAddon.findMany(),
    prisma.organizationAddon.groupBy({
      by: ["source", "organizationId"],
      where: { expiresAt: { gt: new Date() } },
    }),
  ]);
  return ADDON_SOURCES.map(({ key, name, description }) => {
    const setting = settings.find((row) => row.source === key);
    return {
      key,
      name,
      description,
      price: setting?.price ?? null,
      durationDays: setting?.durationDays ?? null,
      status: setting?.status ?? null,
      activeCount: active.filter((row) => row.source === key).length,
    };
  });
}

const PackagesPage = async () => {
  await requireAdminPage();
  const addons = await addonRows();
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
      <AddonsManager addons={addons} />
    </div>
  );
};

export default PackagesPage;
