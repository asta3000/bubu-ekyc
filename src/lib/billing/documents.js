import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatMoney, personName } from "@/lib/format";
import { escapeHtml, sendMail } from "@/lib/mail";
import { getSystemInfo } from "@/lib/system";
import { signValue, verifyValueSignature } from "@/lib/tokens";
import { activeBankAccounts } from "./bank-accounts";
import { PAYMENT_PURPOSES } from "./labels";

// Хэтэвч цэнэглэх нэхэмжлэх ба зарлагын баримт (имэйл). Хоёулаа QR-тай: уншуулахад
// /verify/payment/<id> хуудас системээс баримтын үнэн бодит байдал, одоогийн төлвийг харуулна.

const PURPOSE = "payment-document";

export const paymentVerifyUrl = (paymentId) =>
  `${(process.env.AUTH_URL ?? "").replace(/\/$/, "")}/verify/payment/${paymentId}?s=${signValue(PURPOSE, paymentId)}`;

export const isValidPaymentSignature = (paymentId, signature) => verifyValueSignature(PURPOSE, paymentId, signature);

// Баримтад шаардлагатай бүх мэдээлэлтэй төлбөр (имэйл ба шалгах хуудсанд)
export async function loadPaymentDocument(id) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      organization: {
        select: { id: true, name: true, registerNumber: true, customerNumber: true, address: true, email: true, phone: true },
      },
      createdBy: { select: { firstName: true, lastName: true, email: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!payment) return null;
  // Цэнэглэлтийн дараах хэтэвчний үлдэгдэл (зарлагын баримтад)
  const transaction = await prisma.walletTransaction.findFirst({
    where: { paymentId: id, type: "TOPUP" },
    select: { balanceAfter: true },
  });
  return { ...payment, balanceAfter: transaction?.balanceAfter ?? null };
}

// Бодитоор төлсөн хэрэгсэл: админ баталгаажуулсан бол банкны шилжүүлэг, үгүй бол QPay
export const paidVia = (payment) => (payment.reviewedById || !payment.qpayInvoiceId ? "Банкны шилжүүлэг" : "QPay");

// Нэхэмжлэх хүлээн авагчид: хүсэлт гаргасан хэрэглэгч ба байгууллагын идэвхтэй админууд.
// Хэн ч байхгүй бол байгууллагын имэйл.
async function recipients(payment) {
  const admins = await prisma.user.findMany({
    where: { organizationId: payment.organizationId, role: "ORG_ADMIN", status: "ACTIVE" },
    select: { email: true },
  });
  const emails = [...new Set([payment.createdBy?.email, ...admins.map((admin) => admin.email)].filter(Boolean))];
  return emails.length ? emails : [payment.organization.email].filter(Boolean);
}

// ---- HTML хэсгүүд (имэйлийн клиентүүдэд зориулж inline style, table) ----

const e = escapeHtml;
const cell = "padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;vertical-align:top";
const label = "color:#6b7280;font-size:12px";

const header = (system, title, number, dateLabel, date) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid #111827;padding-bottom:12px">
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:22px;font-weight:bold">Verdec<span style="color:#2563eb">X</span></div>
        <div style="${label}">${[system.address, system.phone, system.email, system.website].filter(Boolean).map(e).join(" · ")}</div>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:18px;font-weight:bold;letter-spacing:1px">${e(title)}</div>
        <div style="font-size:13px">№ <b style="font-family:monospace">${e(number)}</b></div>
        <div style="${label}">${e(dateLabel)}: ${e(formatDateTime(date))}</div>
      </td>
    </tr>
  </table>`;

const party = (payment) => {
  const org = payment.organization;
  const rows = [
    ["Байгууллага", org.name],
    ["Регистрийн дугаар", org.registerNumber],
    ["Харилцагчийн дугаар", org.customerNumber],
    ["Хаяг", org.address],
    ["Холбоо барих", [org.phone, org.email].filter(Boolean).join(", ")],
    ["Хүсэлт гаргасан", payment.createdBy ? personName(payment.createdBy) : null],
  ].filter(([, value]) => value);
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
    ${rows.map(([key, value]) => `<tr><td style="${label};width:160px;padding:2px 0">${e(key)}</td><td style="font-size:13px;padding:2px 0">${e(value)}</td></tr>`).join("")}
  </table>`;
};

const items = (payment, extraRows = []) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e5e7eb;border-collapse:collapse">
    <tr style="background:#f9fafb">
      <td style="${cell};width:32px"><b>№</b></td><td style="${cell}"><b>Гүйлгээний утга</b></td><td style="${cell};text-align:right"><b>Дүн</b></td>
    </tr>
    <tr>
      <td style="${cell}">1</td>
      <td style="${cell}">${e(PAYMENT_PURPOSES[payment.purpose] ?? payment.purpose)} (${e(payment.reference)})</td>
      <td style="${cell};text-align:right">${e(formatMoney(payment.amount))}</td>
    </tr>
    <tr>
      <td style="${cell}" colspan="2"><b>Нийт дүн</b></td>
      <td style="${cell};text-align:right;font-size:15px"><b>${e(formatMoney(payment.amount))}</b></td>
    </tr>
    ${extraRows.map(([key, value]) => `<tr><td style="${cell}" colspan="2">${e(key)}</td><td style="${cell};text-align:right">${e(value)}</td></tr>`).join("")}
  </table>`;

const verifyBlock = (url, text) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px dashed #d1d5db;padding-top:16px">
    <tr>
      <td style="width:130px;vertical-align:top"><img src="cid:verify-qr" width="120" height="120" alt="Баримт шалгах QR" style="display:block"></td>
      <td style="vertical-align:top;font-size:12px;color:#374151">
        <b>Баримтын үнэн бодит байдлыг шалгах</b><br>
        ${e(text)}<br>
        <a href="${e(url)}" style="color:#2563eb;word-break:break-all">${e(url)}</a>
      </td>
    </tr>
  </table>`;

const layout = (body) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827;padding:16px">
  ${body}
  <p style="margin-top:24px;font-size:11px;color:#9ca3af">VerdecX · Энэ баримт системээс автоматаар үүссэн. НӨАТ-ын цахим баримт (e-barimt) биш.</p>
</div>`;

const qrAttachment = async (url) => ({
  filename: "verify-qr.png",
  content: await QRCode.toBuffer(url, { width: 240, margin: 1 }),
  cid: "verify-qr",
});

// ---- Нэхэмжлэх ----

export async function renderInvoice(payment) {
  const [system, bankAccounts] = await Promise.all([getSystemInfo(), activeBankAccounts()]);
  const url = paymentVerifyUrl(payment.id);
  const qpay = payment.qpayInvoice ?? null;
  const attachments = [await qrAttachment(url)];
  if (qpay?.qrImage) {
    attachments.push({ filename: "qpay-qr.png", content: Buffer.from(qpay.qrImage, "base64"), cid: "qpay-qr" });
  }

  const qpayBlock = qpay
    ? `
    <td style="width:50%;vertical-align:top;padding:12px;border:1px solid #e5e7eb">
      <div style="font-weight:bold;margin-bottom:8px">1. QPay-ээр төлөх</div>
      ${qpay.qrImage ? `<img src="cid:qpay-qr" width="170" height="170" alt="QPay QR" style="display:block">` : ""}
      <div style="font-size:12px;color:#374151;margin-top:6px">Банкны аппаараа QR кодыг уншуулна. Төлөгдмөгц хэтэвч автоматаар цэнэглэгдэнэ.</div>
      ${qpay.shortUrl ? `<div style="margin-top:6px"><a href="${e(qpay.shortUrl)}" style="color:#2563eb;font-size:12px">${e(qpay.shortUrl)}</a></div>` : ""}
    </td>`
    : "";
  const bankBlock = `
    <td style="vertical-align:top;padding:12px;border:1px solid #e5e7eb">
      <div style="font-weight:bold;margin-bottom:8px">${qpay ? "2. " : ""}Банкны шилжүүлгээр төлөх</div>
      ${
        bankAccounts.length
          ? bankAccounts
              .map(
                (account) => `<div style="font-size:12px;margin-bottom:8px">
          <b>${e(account.bankName)}</b><br>
          <span style="${label}">Хүлээн авагч:</span> ${e(account.accountName)}<br>
          <span style="${label}">Данс:</span> <span style="font-family:monospace">${e(account.accountNumber)}</span>
          ${account.iban ? `<br><span style="${label}">IBAN:</span> <span style="font-family:monospace">${e(account.iban)}</span>` : ""}
        </div>`,
              )
              .join("")
          : `<div style="font-size:12px;color:#b91c1c">Хүлээн авах данс тохируулаагүй байна.</div>`
      }
      <div style="font-size:12px;background:#fef3c7;padding:6px 8px">Гүйлгээний утгад <b style="font-family:monospace">${e(payment.reference)}</b> гэж заавал бичнэ үү. Админ шалгаж баталгаажуулсны дараа хэтэвч цэнэглэгдэнэ.</div>
    </td>`;

  const html = layout(`
    ${header(system, "НЭХЭМЖЛЭХ", payment.reference, "Огноо", payment.createdAt)}
    ${party(payment)}
    ${items(payment)}
    <div style="margin-top:20px;font-size:14px;font-weight:bold">Төлбөр төлөх</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse"><tr>${qpayBlock}${bankBlock}</tr></table>
    ${verifyBlock(url, "QR кодыг утсаараа уншуулж энэ нэхэмжлэх VerdecX системээс гарсан эсэх, төлбөрийн төлвийг шалгана уу.")}
  `);
  const text = [
    `НЭХЭМЖЛЭХ № ${payment.reference}`,
    `Байгууллага: ${payment.organization.name}`,
    `${PAYMENT_PURPOSES[payment.purpose]}: ${formatMoney(payment.amount)}`,
    "",
    qpay?.shortUrl ? `QPay-ээр төлөх: ${qpay.shortUrl}` : null,
    ...bankAccounts.map((account) => `${account.bankName}: ${account.accountNumber} (${account.accountName})`),
    `Гүйлгээний утга: ${payment.reference}`,
    "",
    `Баримт шалгах: ${url}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return { subject: `Нэхэмжлэх № ${payment.reference}: ${formatMoney(payment.amount)}`, html, text, attachments };
}

// ---- Зарлагын баримт ----

export async function renderReceipt(payment) {
  const system = await getSystemInfo();
  const url = paymentVerifyUrl(payment.id);
  const balance = payment.balanceAfter;
  const html = layout(`
    ${header(system, "ЗАРЛАГЫН БАРИМТ", payment.reference, "Төлсөн огноо", payment.paidAt)}
    ${party(payment)}
    ${items(payment, [
      ["Төлбөрийн хэрэгсэл", paidVia(payment)],
      ["Төлөв", "Төлөгдсөн"],
      ...(balance != null ? [["Хэтэвчний үлдэгдэл", formatMoney(balance)]] : []),
    ])}
    <p style="margin-top:16px;font-size:13px;padding:10px;background:#ecfdf5;color:#065f46">
      ${e(formatMoney(payment.amount))} төлбөр хүлээн авч, байгууллагын хэтэвч цэнэглэгдлээ.
    </p>
    ${verifyBlock(url, "QR кодыг утсаараа уншуулж энэ баримт VerdecX системээс гарсан эсэхийг шалгана уу.")}
  `);
  const text = [
    `ЗАРЛАГЫН БАРИМТ № ${payment.reference}`,
    `Байгууллага: ${payment.organization.name}`,
    `${PAYMENT_PURPOSES[payment.purpose]}: ${formatMoney(payment.amount)}`,
    `Төлсөн: ${formatDateTime(payment.paidAt)} (${paidVia(payment)})`,
    balance != null ? `Хэтэвчний үлдэгдэл: ${formatMoney(balance)}` : null,
    "",
    `Баримт шалгах: ${url}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
  return {
    subject: `Зарлагын баримт № ${payment.reference}: ${formatMoney(payment.amount)} төлөгдлөө`,
    html,
    text,
    attachments: [await qrAttachment(url)],
  };
}

// ---- Илгээх. Имэйл алдаа нь төлбөрийн урсгалыг зогсоохгүй (лог л үлдээнэ). ----

async function sendDocument(paymentId, render, expected) {
  try {
    const payment = await loadPaymentDocument(paymentId);
    if (!payment || payment.purpose !== "WALLET_TOPUP" || !expected(payment)) return false;
    const to = await recipients(payment);
    if (!to.length) return false;
    await sendMail({ to, ...(await render(payment)) });
    return true;
  } catch (error) {
    console.error(`[documents] ${paymentId}:`, error.message);
    return false;
  }
}

export const sendTopupInvoice = (paymentId) => sendDocument(paymentId, renderInvoice, (payment) => payment.status === "PENDING");

export const sendTopupReceipt = (paymentId) => sendDocument(paymentId, renderReceipt, (payment) => payment.status === "PAID");
