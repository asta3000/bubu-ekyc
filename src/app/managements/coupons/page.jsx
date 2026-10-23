import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { couponState } from "@/lib/coupons";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import CouponsManager from "./coupons-manager";

export const metadata = { title: "Купон" };

const CouponsPage = async () => {
  await requireAdminPage();
  const [coupons, organizations] = await Promise.all([
    prisma.coupon.findMany({
      where: notDeleted,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        description: true,
        discountType: true,
        discountValue: true,
        usageLimit: true,
        usedCount: true,
        startsAt: true,
        expiresAt: true,
        status: true,
        createdAt: true,
        organizationId: true,
        organization: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.organization.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  const now = new Date();
  return (
    <div className="space-y-6">
      <PageTitle title="Купон" description="Хөнгөлөлтийн купон үүсгэх, удирдах" />
      <CouponsManager
        coupons={coupons.map((coupon) => ({ ...coupon, state: couponState(coupon, now) }))}
        organizations={organizations}
      />
    </div>
  );
};

export default CouponsPage;
