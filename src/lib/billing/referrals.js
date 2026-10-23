import { formatMoney } from "@/lib/format";
import { changeBalance } from "./wallet";

// Урамшуулал олгох төлбөрийн аргууд: гаднаас бодит мөнгө орж ирсэн үед л.
// Хэтэвчнээс зарцуулахад тооцохгүй (цэнэглэх үед аль хэдийн тооцсон).
const REWARDED_METHODS = ["QPAY", "BANK_TRANSFER"];

// Төлбөр төлөгдөхөд санал болгосон байгууллага (промо кодын эзэн)-ын хэтэвчинд промо кодын
// хувиар (Promo.discount) урамшуулал олгоно. Transaction (tx) дотор, төлбөр PAID болсны дараа.
// Нэг төлбөрөөс нэг л удаа (ReferralReward.paymentId unique).
export async function grantReferralReward(tx, payment) {
  if (!REWARDED_METHODS.includes(payment.method)) return null;

  const payer = await tx.organization.findUnique({
    where: { id: payment.organizationId },
    select: {
      name: true,
      referralPromo: { select: { discount: true, organizationId: true, organization: { select: { status: true } } } },
    },
  });
  const promo = payer?.referralPromo;
  if (!promo?.organizationId || promo.organizationId === payment.organizationId) return null;
  if (promo.organization.status !== "ACTIVE") return null;

  const amount = Math.floor((payment.amount * promo.discount) / 100);
  if (amount <= 0) return null;

  const reward = await tx.referralReward.create({
    data: {
      referrerId: promo.organizationId,
      referredId: payment.organizationId,
      paymentId: payment.id,
      rate: promo.discount,
      amount,
    },
  });
  await changeBalance(tx, {
    organizationId: promo.organizationId,
    amount,
    type: "REFERRAL_BONUS",
    description: `${payer.name}-ийн ${formatMoney(payment.amount)} төлбөрөөс ${promo.discount}%`,
    paymentId: payment.id,
  });
  return reward;
}
