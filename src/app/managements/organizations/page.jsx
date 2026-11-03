import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { organizationLogoSrc } from "@/lib/blob";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import OrganizationsManager from "./organizations-manager";

export const metadata = { title: "Байгууллага" };

const OrganizationsPage = async () => {
  await requireAdminPage();
  const [organizations, operations] = await Promise.all([
    prisma.organization.findMany({
      where: notDeleted,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        customerNumber: true,
        registerNumber: true,
        contractSigned: true,
        address: true,
        email: true,
        backupEmail: true,
        phone: true,
        backupPhone: true,
        logo: true,
        status: true,
        operationId: true,
        createdAt: true,
        // Одоо хүчинтэй багц (activeSubscription-тэй ижил нөхцөл)
        subscriptions: {
          where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          orderBy: { startsAt: "desc" },
          take: 1,
          select: { packageName: true, expiresAt: true },
        },
        updatedAt: true,
        operation: { select: { name: true } },
        promos: { orderBy: { createdAt: "desc" }, take: 1, select: { code: true, discount: true } },
        referralPromo: { select: { code: true, organization: { select: { name: true } } } },
        _count: { select: { users: { where: notDeleted } } },
      },
    }),
    prisma.operation.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Байгууллага" description="KYC үйлчилгээ авах байгууллагууд" />
      <OrganizationsManager
        // Blob-ийн жинхэнэ хаягийг биш, app-ийн API-ийн хаягийг client-д өгнө
        organizations={organizations.map(({ updatedAt, promos, referralPromo, subscriptions, ...organization }) => ({
          ...organization,
          subscription: subscriptions[0] ?? null,
          referralCode: referralPromo?.code ?? null,
          referredBy: referralPromo?.organization?.name ?? null,
          logo: organizationLogoSrc({ ...organization, updatedAt }),
          promoCode: promos[0]?.code ?? null,
          promoRate: promos[0]?.discount ?? null,
        }))}
        operations={operations}
      />
    </div>
  );
};

export default OrganizationsPage;
