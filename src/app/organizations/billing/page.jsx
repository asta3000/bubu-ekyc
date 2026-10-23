import { prisma } from "@/lib/prisma";
import { activeBankAccounts } from "@/lib/billing/bank-accounts";
import { minTopupAmount } from "@/lib/billing/payments";
import { isQpayConfigured } from "@/lib/billing/qpay";
import { activeSubscription } from "@/lib/billing/subscriptions";
import { getWallet } from "@/lib/billing/wallet";
import { requireOrganizationPage } from "@/lib/organization-access";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import BillingClient from "./billing-client";

export const metadata = { title: "Багц, төлбөр" };

const PAGE = {
  title: "Багц, төлбөр",
  description: "Байгууллагын багц, үйлчилгээний үлдэгдэл, хэтэвч ба төлбөрүүд. Ашиглах тоог бүх ажилтан дундаа хэрэглэнэ.",
};

const HISTORY_LIMIT = 30;

// Байгууллагын промо код, түүгээр бүртгүүлсэн байгууллагын тоо, авсан нийт урамшуулал
async function referralSummary(organizationId) {
  const [promo, referred, earned] = await Promise.all([
    prisma.promo.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { code: true, discount: true },
    }),
    prisma.organization.count({ where: { referralPromo: { organizationId }, status: { not: "DELETED" } } }),
    prisma.referralReward.aggregate({ where: { referrerId: organizationId }, _sum: { amount: true }, _count: true }),
  ]);
  return { promo, referred, earnedAmount: earned._sum.amount ?? 0, earnedCount: earned._count };
}

const BillingPage = async () => {
  const { organization, accessError } = await requireOrganizationPage();
  const error = accessError ?? (!organization && "Таны бүртгэл байгууллагад холбогдоогүй байна.");
  if (error) return <AccessDenied {...PAGE} error={error} />;

  const wallet = await getWallet(organization.id);
  const [subscription, packages, payments, transactions, bankAccounts, minTopup, referral] = await Promise.all([
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
      />
    </>
  );
};

export default BillingPage;
