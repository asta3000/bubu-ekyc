import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { MAX_BANK_ACCOUNTS } from "@/lib/billing/bank-accounts";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import BankAccountsManager from "./bank-accounts-manager";
import PaymentsManager from "./payments-manager";

export const metadata = { title: "Төлбөр" };

const PAYMENT_LIMIT = 200;

const PAYMENT_SELECT = {
  id: true,
  purpose: true,
  method: true,
  status: true,
  amount: true,
  reference: true,
  adminNote: true,
  createdAt: true,
  paidAt: true,
  organization: { select: { name: true } },
  subscription: { select: { packageName: true } },
  redemption: { select: { coupon: { select: { code: true } } } },
  createdBy: { select: { firstName: true, lastName: true } },
  reviewedBy: { select: { firstName: true, lastName: true } },
};

const PaymentsPage = async () => {
  await requireAdminPage();
  const [accounts, payments] = await Promise.all([
    prisma.bankAccount.findMany({
      where: notDeleted,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, bankName: true, accountName: true, accountNumber: true, iban: true, sortOrder: true, status: true },
    }),
    // Хүлээгдэж буй бүх төлбөр + сүүлийн бусад төлбөрүүд (хуучин хүлээгдэж буй нь алга болохгүй)
    Promise.all([
      prisma.payment.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, select: PAYMENT_SELECT }),
      prisma.payment.findMany({
        where: { status: { not: "PENDING" } },
        orderBy: { createdAt: "desc" },
        take: PAYMENT_LIMIT,
        select: PAYMENT_SELECT,
      }),
    ]).then(([pending, others]) => [...pending, ...others].sort((a, b) => b.createdAt - a.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle title="Төлбөр" description="Байгууллагуудын төлбөр, банкны шилжүүлгийн баталгаажуулалт" />
      <BankAccountsManager accounts={accounts} max={MAX_BANK_ACCOUNTS} />
      <PaymentsManager payments={payments} />
    </div>
  );
};

export default PaymentsPage;
