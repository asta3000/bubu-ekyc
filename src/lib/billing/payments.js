import { prisma } from "@/lib/prisma";
import { uniqueCode } from "@/lib/codes";
import { formatMoney } from "@/lib/format";
import { cancelInvoice, createInvoice, isQpayConfigured, paidAmount } from "./qpay";
import { sendTopupReceipt } from "./documents";
import { grantReferralReward } from "./referrals";
import { activateSubscription, createSubscription } from "./subscriptions";
import { evaluateCoupon, redeemCoupon, releaseCoupon } from "./coupons";
import { changeBalance, lockWallet } from "./wallet";

export class PaymentError extends Error {}

// Багц худалдан авах, идэвхжүүлэх transaction. Нэг байгууллагын хүсэлтүүд хэтэвчний
// түгжээгээр ээлжилдэг тул хүлээх хугацааг (Prisma-ийн анхдагч 5с) уртасгана.
export const LOCKED_TRANSACTION = { maxWait: 15_000, timeout: 30_000 };

// Банкны гүйлгээний утга / QPay sender_invoice_no
export const uniqueReference = async () =>
  `KYC${await uniqueCode(async (code) =>
    Boolean(await prisma.payment.findUnique({ where: { reference: `KYC${code}` }, select: { id: true } })),
  )}`;

const DESCRIPTIONS = {
  WALLET_TOPUP: (payment) => `Хэтэвч цэнэглэх ${formatMoney(payment.amount)}`,
  PACKAGE_PURCHASE: (payment) => `Багцын төлбөр ${formatMoney(payment.amount)}`,
};

// QPay нэхэмжлэх үүсгэж төлбөрт хадгална. Callback нь төлбөрийн id-тай.
async function attachQpayInvoice(payment) {
  const invoice = await createInvoice({
    reference: payment.reference,
    amount: payment.amount,
    description: DESCRIPTIONS[payment.purpose](payment),
    callbackUrl: `${process.env.AUTH_URL}/api/payments/qpay/callback?payment=${payment.id}`,
  });
  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      qpayInvoiceId: invoice.invoice_id,
      qpayInvoice: {
        qrText: invoice.qr_text,
        qrImage: invoice.qr_image,
        shortUrl: invoice.qPay_shortUrl ?? null,
        urls: (invoice.urls ?? []).map(({ name, logo, link }) => ({ name, logo, link })),
      },
    },
  });
}

// QPay төлбөрт нэхэмжлэх үүсгэнэ. Амжилтгүй бол төлбөр (ба захиалга)-ийг цуцална.
async function withQpayInvoice(payment) {
  if (payment.method !== "QPAY") return payment;
  try {
    return await attachQpayInvoice(payment);
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED", adminNote: error.message } });
      await tx.subscription.updateMany({
        where: { id: payment.subscriptionId ?? "", status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      await releaseCoupon(tx, payment.id);
    });
    throw new PaymentError(error.message);
  }
}

// Төлбөр хүлээгдэж буй багцын худалдан авалт байгаа эсэх
export const hasPendingPurchase = async (tx, organizationId) =>
  Boolean(
    await tx.payment.findFirst({
      where: { organizationId, purpose: "PACKAGE_PURCHASE", status: "PENDING" },
      select: { id: true },
    }),
  );

// Төлбөр хүлээгдэж буй багц байвал шинээр авахыг хориглоно. Эс тэгвэл хуучин төлбөр
// хожим баталгаажихад түүний дараа авсан багцыг дуусгана.
async function assertNoPendingPurchase(tx, organizationId) {
  if (await hasPendingPurchase(tx, organizationId)) {
    throw new PaymentError("Төлбөр хүлээгдэж буй багц байна. Эхлээд түүнийг төлөх эсвэл цуцална уу.");
  }
}

// Хэтэвчинд мөнгө орсон эсвэл багц идэвхжсэний дараа (transaction commit болсны дараа)
// хэтэвч хүрэлцээгүйгээс сунгагдаагүй багц, дараа нь нэмэлт жагсаалтуудыг сунгана.
// Амжилтгүй болсон ч үндсэн үйлдэл хэрэгжсэн хэвээр (дараагийн шалгалтаар дахин оролдоно).
async function renewAfter(organizationIds) {
  // renewals.js нь энэ модулийг импортолдог тул тойрог импортоос зайлсхийнэ
  const { renewDue } = await import("./renewals");
  for (const organizationId of new Set(organizationIds)) {
    await renewDue(organizationId).catch((error) => console.error("[renewal]", organizationId, error.message));
  }
}

// Идэвхтэй багц байхгүй үеийн цэнэглэх доод дүн
const FALLBACK_MIN_TOPUP = 1000;

// Хэтэвч цэнэглэх доод дүн: суурь үнэтэй хамгийн хямд идэвхтэй багцын үнэ
export async function minTopupAmount() {
  const cheapest = await prisma.package.findFirst({
    where: { status: "ACTIVE", basePrice: { gt: 0 } },
    orderBy: { basePrice: "asc" },
    select: { basePrice: true },
  });
  return cheapest?.basePrice ?? FALLBACK_MIN_TOPUP;
}

// Хэтэвч цэнэглэх (QPay, банкны шилжүүлэг). Нэхэмжлэхэд QPay ба банкны данс хоёуланг
// харуулдаг тул QPay тохируулсан бол банкаар сонгосон ч QPay нэхэмжлэх үүсгэнэ (аль нэгээр
// төлөхөд хэрэгжинэ). Банкаар сонгосон үед QPay нэхэмжлэх үүсгэж чадаагүй ч төлбөр хэвээр.
export async function createTopup({ organizationId, userId, amount, method }) {
  const payment = await prisma.payment.create({
    data: {
      organizationId,
      createdById: userId,
      purpose: "WALLET_TOPUP",
      method,
      amount,
      reference: await uniqueReference(),
    },
  });
  if (method === "QPAY") return withQpayInvoice(payment);
  if (!isQpayConfigured()) return payment;
  return attachQpayInvoice(payment).catch((error) => {
    console.error(`[qpay] topup ${payment.id} invoice:`, error.message);
    return payment;
  });
}

// Багц худалдаж авах. Төлөх дүн 0 (үнэгүй багц, 100% купон) эсвэл хэтэвчээр төлбөл шууд
// идэвхжинэ. couponCode: үнийг хямдруулах эсвэл хугацааг сунгах купон (нэг худалдан авалтад нэг).
// Буцаах: { subscription, payment } (payment нь QPay/банкны үед хүлээгдэж буй)
export async function purchasePackage({ organizationId, userId, packageId, method, couponCode = null }) {
  const pkg = await prisma.package.findFirst({ where: { id: packageId, status: "ACTIVE" }, include: { items: true } });
  if (!pkg) throw new PaymentError("Багц олдсонгүй");

  const result = await prisma.$transaction(async (tx) => {
    await lockWallet(tx, organizationId);
    await assertNoPendingPurchase(tx, organizationId);

    // Купоныг түгжээний дотор шалгана (зэрэг худалдан авалт нэг купоныг хоёр удаа хэрэглэхгүй)
    const coupon = couponCode ? await evaluateCoupon(tx, { code: couponCode, organizationId, pkg }) : null;
    const price = coupon?.finalPrice ?? pkg.basePrice;
    const subscription = await createSubscription(pkg, organizationId, tx, { extraDays: coupon?.extraDays ?? 0 });
    const redeem = (paymentId) =>
      coupon && redeemCoupon(tx, coupon, { organizationId, subscriptionId: subscription.id, paymentId });

    if (price === 0) {
      await redeem(null);
      return { subscription: await activateSubscription(tx, subscription.id), payment: null };
    }

    const immediate = method === "WALLET";
    const payment = await tx.payment.create({
      data: {
        organizationId,
        createdById: userId,
        purpose: "PACKAGE_PURCHASE",
        method,
        status: immediate ? "PAID" : "PENDING",
        amount: price,
        subscriptionId: subscription.id,
        reference: await uniqueReference(),
        paidAt: immediate ? new Date() : null,
      },
    });
    await redeem(payment.id);
    if (!immediate) return { subscription, payment };

    // Үлдэгдэл хүрэлцэхгүй бол бүх transaction (купон ч) буцна
    await changeBalance(tx, {
      organizationId,
      amount: -price,
      type: "PACKAGE_PURCHASE",
      description: `"${pkg.name}" багцын суурь үнэ${coupon?.discountAmount ? ` (купон ${coupon.coupon.code})` : ""}`,
      paymentId: payment.id,
      userId,
    });
    return { subscription: await activateSubscription(tx, subscription.id), payment };
  }, LOCKED_TRANSACTION);

  if (result.payment?.status === "PENDING") return { ...result, payment: await withQpayInvoice(result.payment) };
  // Шууд идэвхжсэн бол идэвхтэй багц шаарддаг, төлбөр хүлээж буй нэмэлт жагсаалтуудыг сунгана
  await renewAfter([organizationId]);
  return result;
}

// Төлбөрийг төлөгдсөн болгож үр дүнг хэрэгжүүлнэ (хэтэвч цэнэглэх / багц идэвхжүүлэх,
// санал болголтын урамшуулал).
// Нэг төлбөрийг хоёр удаа хэрэгжүүлэхгүй (PENDING-ээс л шилжинэ). Шилжсэн бол true.
export async function completePayment(paymentId, { reviewedById = null } = {}) {
  const completed = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "PAID", paidAt: now, ...(reviewedById && { reviewedById, reviewedAt: now }) },
    });
    if (!count) return false;

    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (payment.purpose === "WALLET_TOPUP") {
      await changeBalance(tx, {
        organizationId: payment.organizationId,
        amount: payment.amount,
        type: "TOPUP",
        description: payment.method === "QPAY" ? "QPay-ээр цэнэглэсэн" : "Банкны шилжүүлгээр цэнэглэсэн",
        paymentId: payment.id,
        userId: payment.createdById,
      });
    } else if (payment.subscriptionId) {
      await activateSubscription(tx, payment.subscriptionId);
    }
    // Санал болгосон байгууллагад урамшуулал (QPay, банкаар орж ирсэн төлбөрөөс)
    const rewards = await grantReferralReward(tx, payment);
    return { payment, referrerIds: rewards.map((item) => item.referrerId) };
  }, LOCKED_TRANSACTION);
  if (!completed) return false;

  // Цэнэглэлт (хэтэвчинд мөнгө орсон), багц идэвхжсэн (нэмэлт жагсаалтад идэвхтэй багц
  // шаардлагатай), урамшуулал авсан байгууллагуудын хүлээгдэж буй сунгалтыг шууд хийнэ
  await renewAfter([completed.payment.organizationId, ...completed.referrerIds]);
  // Хэтэвч цэнэглэгдсэн бол зарлагын баримтыг имэйлээр илгээнэ (алдаа нь төлбөрт нөлөөлөхгүй)
  if (completed.payment.purpose === "WALLET_TOPUP") await sendTopupReceipt(completed.payment.id);
  return true;
}

// Хүлээгдэж буй төлбөрийг хаана (админ татгалзах / байгууллага цуцлах). Захиалгыг ч цуцалж,
// ашигласан купоныг чөлөөлнө.
// QPay-д эхлээд нэхэмжлэхийг цуцалж (цаашид төлөх боломжгүй болгоод), дараа нь төлөгдсөн
// эсэхийг шалгана: төлөгдсөн байвал цуцлахын оронд хэрэгжүүлнэ.
// force: QPay-ээс шалгаж чадахгүй (тохиргоо алдагдсан, QPay унасан) үед ч хаана — зөвхөн админ.
// Буцаах: "CLOSED" | "PAID" | null (хүлээгдэж буй төлөвт байхгүй)
export async function closePayment(paymentId, { status, reviewedById = null, adminNote = null, force = false }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING") return null;

  if (payment.qpayInvoiceId) {
    await cancelInvoice(payment.qpayInvoiceId);
    let paid = 0;
    try {
      paid = await paidAmount(payment.qpayInvoiceId);
    } catch (error) {
      if (!force) throw error;
    }
    if (paid >= payment.amount) {
      return (await completePayment(payment.id)) ? "PAID" : null;
    }
  }

  const closed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status, adminNote, ...(reviewedById && { reviewedById, reviewedAt: new Date() }) },
    });
    if (!count) return false;
    if (payment.subscriptionId) {
      await tx.subscription.updateMany({
        where: { id: payment.subscriptionId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }
    // Хүлээгдэж байх үед тоолсон купоныг чөлөөлнө
    await releaseCoupon(tx, paymentId);
    return true;
  });
  return closed ? "CLOSED" : null;
}

// QPay-ийн төлөгдсөн эсэхийг шалгаж, төлөгдсөн бол хэрэгжүүлнэ. Банкаар сонгосон цэнэглэлт
// ч QPay нэхэмжлэхтэй байж болно.
export async function syncQpayPayment(payment) {
  if (payment.status !== "PENDING" || !payment.qpayInvoiceId) return false;
  const paid = await paidAmount(payment.qpayInvoiceId);
  return paid >= payment.amount ? completePayment(payment.id) : false;
}

// Админ банкны шилжүүлэг орж ирснийг баталгаажуулна. QPay нэхэмжлэхтэй бол эхлээд түүнийг
// хааж (дахин төлөгдөхөөс сэргийлнэ), энэ хооронд QPay-ээр төлөгдсөн байвал түүгээр хэрэгжүүлнэ.
// Буцаах: хэрэгжсэн бол true
export async function confirmBankPayment(paymentId, { reviewedById }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING") return false;
  if (payment.qpayInvoiceId) {
    await cancelInvoice(payment.qpayInvoiceId);
    const paid = await paidAmount(payment.qpayInvoiceId).catch(() => 0);
    if (paid >= payment.amount) return completePayment(payment.id);
  }
  return completePayment(payment.id, { reviewedById });
}
