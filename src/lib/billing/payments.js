import { prisma } from "@/lib/prisma";
import { uniqueCode } from "@/lib/codes";
import { formatMoney } from "@/lib/format";
import { cancelInvoice, createInvoice, paidAmount } from "./qpay";
import { grantReferralReward } from "./referrals";
import { activateSubscription, createSubscription } from "./subscriptions";
import { evaluateCoupon, redeemCoupon, releaseCoupon } from "./coupons";
import { changeBalance, lockWallet } from "./wallet";

export class PaymentError extends Error {}

// Багц худалдан авах, идэвхжүүлэх transaction. Нэг байгууллагын хүсэлтүүд хэтэвчний
// түгжээгээр ээлжилдэг тул хүлээх хугацааг (Prisma-ийн анхдагч 5с) уртасгана.
const LOCKED_TRANSACTION = { maxWait: 15_000, timeout: 30_000 };

// Банкны гүйлгээний утга / QPay sender_invoice_no
const uniqueReference = async () =>
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

// Төлбөр хүлээгдэж буй багц байвал шинээр авахыг хориглоно. Эс тэгвэл хуучин төлбөр
// хожим баталгаажихад түүний дараа авсан багцыг дуусгана.
async function assertNoPendingPurchase(tx, organizationId) {
  const pending = await tx.payment.findFirst({
    where: { organizationId, purpose: "PACKAGE_PURCHASE", status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    throw new PaymentError("Төлбөр хүлээгдэж буй багц байна. Эхлээд түүнийг төлөх эсвэл цуцална уу.");
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

// Хэтэвч цэнэглэх (QPay, банкны шилжүүлэг)
export const createTopup = async ({ organizationId, userId, amount, method }) =>
  withQpayInvoice(
    await prisma.payment.create({
      data: {
        organizationId,
        createdById: userId,
        purpose: "WALLET_TOPUP",
        method,
        amount,
        reference: await uniqueReference(),
      },
    }),
  );

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

  return result.payment?.status === "PENDING"
    ? { ...result, payment: await withQpayInvoice(result.payment) }
    : result;
}

// Төлбөрийг төлөгдсөн болгож үр дүнг хэрэгжүүлнэ (хэтэвч цэнэглэх / багц идэвхжүүлэх,
// санал болголтын урамшуулал).
// Нэг төлбөрийг хоёр удаа хэрэгжүүлэхгүй (PENDING-ээс л шилжинэ). Шилжсэн бол true.
export async function completePayment(paymentId, { reviewedById = null } = {}) {
  return prisma.$transaction(async (tx) => {
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
    await grantReferralReward(tx, payment);
    return true;
  }, LOCKED_TRANSACTION);
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

// QPay-ийн төлөгдсөн эсэхийг шалгаж, төлөгдсөн бол хэрэгжүүлнэ
export async function syncQpayPayment(payment) {
  if (payment.method !== "QPAY" || payment.status !== "PENDING" || !payment.qpayInvoiceId) return false;
  const paid = await paidAmount(payment.qpayInvoiceId);
  return paid >= payment.amount ? completePayment(payment.id) : false;
}
