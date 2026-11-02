import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { changeBalance } from "./wallet";

// Урамшуулал олгох төлбөрийн аргууд: гаднаас бодит мөнгө орж ирсэн үед л.
// Хэтэвчнээс зарцуулахад тооцохгүй (цэнэглэх үед аль хэдийн тооцсон).
const REWARDED_METHODS = ["QPAY", "BANK_TRANSFER"];

// Урьсан байгууллагыг урьсан байгууллагад (2-р шат) олгох анхдагч хувь
export const DEFAULT_SECOND_REFERRAL_RATE = 1;

// 2-р шатны хувь: админы тохиргоо, тохируулаагүй бол анхдагч
export async function secondReferralRate(db = prisma) {
  const settings = await db.systemSetting.findUnique({ where: { id: "system" }, select: { referralSecondRate: true } });
  return settings?.referralSecondRate ?? DEFAULT_SECOND_REFERRAL_RATE;
}

// Байгууллагыг урьсан (промо кодыг нь ашигласан) байгууллага: { id, status } эсвэл null
const referrerOf = async (tx, organizationId) =>
  (
    await tx.organization.findUnique({
      where: { id: organizationId },
      select: { referralPromo: { select: { organization: { select: { id: true, status: true } } } } },
    })
  )?.referralPromo?.organization ?? null;

// Нэг шатны урамшууллыг бүртгэж хэтэвчинд нэмнэ
async function reward(tx, payment, { referrerId, level, rate, description }) {
  const amount = Math.floor((payment.amount * rate) / 100);
  if (amount <= 0) return null;
  const created = await tx.referralReward.create({
    data: { referrerId, referredId: payment.organizationId, paymentId: payment.id, level, rate, amount },
  });
  await changeBalance(tx, { organizationId: referrerId, amount, type: "REFERRAL_BONUS", description, paymentId: payment.id });
  return created;
}

// Төлбөр төлөгдөхөд санал болголтын урамшуулал олгоно. Transaction (tx) дотор, төлбөр PAID
// болсны дараа. Нэг төлбөрөөс шат бүрт нэг л удаа (ReferralReward [paymentId, level] unique).
//  1-р шат: төлсөн байгууллагыг урьсан (промо кодын эзэн) байгууллагад промо кодын хувиар
//  2-р шат: түүнийг урьсан байгууллагад системийн тохиргооны хувиар (анхдагч 1%)
// Идэвхгүй байгууллага тухайн шатны урамшууллыг авахгүй ч нөгөө шатанд нөлөөлөхгүй.
export async function grantReferralReward(tx, payment) {
  if (!REWARDED_METHODS.includes(payment.method)) return [];

  const payer = await tx.organization.findUnique({
    where: { id: payment.organizationId },
    select: {
      name: true,
      referralPromo: {
        select: { discount: true, organization: { select: { id: true, name: true, status: true } } },
      },
    },
  });
  const first = payer?.referralPromo?.organization;
  if (!first || first.id === payment.organizationId) return [];

  const rewards = [];
  if (first.status === "ACTIVE") {
    rewards.push(
      await reward(tx, payment, {
        referrerId: first.id,
        level: 1,
        rate: payer.referralPromo.discount,
        description: `${payer.name}-ийн ${formatMoney(payment.amount)} төлбөрөөс ${payer.referralPromo.discount}%`,
      }),
    );
  }

  // Тойрог (A→B→A) үүссэн бол төлсөн болон 1-р шатны байгууллагад дахин олгохгүй
  const second = await referrerOf(tx, first.id);
  if (second && second.status === "ACTIVE" && second.id !== payment.organizationId && second.id !== first.id) {
    const rate = await secondReferralRate(tx);
    rewards.push(
      await reward(tx, payment, {
        referrerId: second.id,
        level: 2,
        rate,
        description: `${first.name}-ийн урьсан ${payer.name}-ийн ${formatMoney(payment.amount)} төлбөрөөс ${rate}%`,
      }),
    );
  }
  return rewards.filter(Boolean);
}
