import { prisma } from "@/lib/prisma";
import { activeBankAccounts } from "@/lib/billing/bank-accounts";
import { minTopupAmount } from "@/lib/billing/payments";
import { secondReferralRate } from "@/lib/billing/referrals";
import { isQpayConfigured } from "@/lib/billing/qpay";
import { awaitingRenewal, latestAddons, renewDue } from "@/lib/billing/renewals";
import { activeSubscription } from "@/lib/billing/subscriptions";
import { getWallet } from "@/lib/billing/wallet";
import { requireOrganizationPage } from "@/lib/organization-access";
import { ADDON_SOURCES } from "@/lib/sanctions/sources";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import BillingClient from "./billing-client";

export const metadata = { title: "Багц, төлбөр" };

const PAGE = {
  title: "Багц, төлбөр",
  description: "Байгууллагын багц, үйлчилгээний үлдэгдэл, хэтэвч ба төлбөрүүд. Ашиглах тоог бүх ажилтан дундаа хэрэглэнэ.",
};

const HISTORY_LIMIT = 30;

// Байгууллагын промо код, түүгээр бүртгүүлсэн (1-р шат) ба тэдгээрийн урьсан (2-р шат)
// байгууллагын тоо, шат бүрээр авсан урамшуулал
async function referralSummary(organizationId) {
  const notDeletedOrg = { status: { not: "DELETED" } };
  const [promo, referred, secondReferred, earned, secondRate] = await Promise.all([
    prisma.promo.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { code: true, discount: true },
    }),
    prisma.organization.count({ where: { referralPromo: { organizationId }, ...notDeletedOrg } }),
    prisma.organization.count({
      where: { referralPromo: { organization: { referralPromo: { organizationId } } }, ...notDeletedOrg },
    }),
    prisma.referralReward.groupBy({ by: ["level"], where: { referrerId: organizationId }, _sum: { amount: true } }),
    secondReferralRate(),
  ]);
  const earnedAt = (level) => earned.find((row) => row.level === level)?._sum.amount ?? 0;
  return {
    promo,
    referred,
    secondReferred,
    secondRate,
    earnedAmount: earnedAt(1) + earnedAt(2),
    secondEarnedAmount: earnedAt(2),
  };
}

// Худалдаалж буй (ACTIVE) нэмэлт жагсаалтууд ба байгууллагын хамгийн сүүлийн хугацаа,
// автомат сунгалтын тохиргоо. Худалдаалахаа больсон ч өмнө нь авч байсан бол харуулна.
async function addonOffers(organizationId) {
  const [settings, latest] = await Promise.all([
    prisma.sourceAddon.findMany({ where: { status: "ACTIVE" } }),
    latestAddons(organizationId),
  ]);
  const now = new Date();
  return ADDON_SOURCES.flatMap(({ key, name, description }) => {
    const setting = settings.find((row) => row.source === key);
    const row = latest.find((item) => item.source === key);
    if (!setting && !row) return [];
    return [
      {
        key,
        name,
        description,
        price: setting?.price ?? null,
        durationDays: setting?.durationDays ?? null,
        expiresAt: row?.expiresAt ?? null,
        active: Boolean(row && row.expiresAt > now),
        autoRenew: row?.autoRenew ?? false,
      },
    ];
  });
}

const BillingPage = async () => {
  const { organization, accessError } = await requireOrganizationPage();
  const error = accessError ?? (!organization && "Таны бүртгэл байгууллагад холбогдоогүй байна.");
  if (error) return <AccessDenied {...PAGE} error={error} />;

  // Сунгалт хэтэвчнээс суутгах тул үлдэгдлийг уншихаас өмнө
  await renewDue(organization.id);
  const wallet = await getWallet(organization.id);
  const [subscription, packages, payments, transactions, bankAccounts, minTopup, referral, addons, awaiting] = await Promise.all([
    activeSubscription(organization.id),
    prisma.package.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ basePrice: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        durationDays: true,
        items: { select: { service: true, quota: true, unitPrice: true } },
      },
    }),
    prisma.payment.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        purpose: true,
        method: true,
        status: true,
        amount: true,
        reference: true,
        qpayInvoice: true,
        adminNote: true,
        createdAt: true,
        subscription: { select: { packageName: true } },
        redemption: { select: { coupon: { select: { code: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { id: true, type: true, amount: true, balanceAfter: true, description: true, createdAt: true },
    }),
    activeBankAccounts(),
    minTopupAmount(),
    referralSummary(organization.id),
    addonOffers(organization.id),
    awaitingRenewal(organization.id),
  ]);

  return (
    <>
      <PageTitle {...PAGE} />
      <BillingClient
        balance={wallet.balance}
        subscription={subscription}
        packages={packages}
        payments={payments}
        transactions={transactions}
        bankAccounts={bankAccounts}
        qpayEnabled={isQpayConfigured()}
        minTopup={minTopup}
        referral={referral}
        addons={addons}
        awaiting={awaiting}
      />
    </>
  );
};

export default BillingPage;
