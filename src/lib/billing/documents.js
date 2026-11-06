import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatMoney, personName } from "@/lib/format";
import { escapeHtml, sendMail } from "@/lib/mail";
import { getSystemInfo } from "@/lib/system";
import { signValue, verifyValueSignature } from "@/lib/tokens";
import { activeBankAccounts } from "./bank-accounts";
import { paymentPurpose } from "./labels";

// Төлбөрийн баримтууд. Нэг гүйлгээнд (Payment) нэг л нэхэмжлэх, нэг л зарлагын баримт, нэг л
// орлогын баримт: дугаар нь гүйлгээний утга (reference) тул дахин хэвлэх, илгээхэд ижил баримт гарна.
//   invoice: нэхэмжлэх (байгууллагад, төлөх заавартай)
//   receipt: зарлагын баримт (байгууллагад, төлөгдсөний дараа)
//   income:  орлогын баримт (системийн админд, төлөгдсөний дараа)
// Бүгд QR-тай: уншуулахад /verify/payment/<id> хуудас баримтын үнэн бодит байдал, төлвийг харуулна.
// Хэтэвчээр төлсөн (дотоод) гүйлгээнд баримт гарахгүй, гаднаас мөнгө орж ирсэн QPay, банкны л.

const PURPOSE = "payment-document";
const EXTERNAL_METHODS = ["QPAY", "BANK_TRANSFER"];

export const DOCUMENT_TYPES = {
  invoice: { title: "НЭХЭМЖЛЭХ", name: "Нэхэмжлэх" },
  receipt: { title: "ЗАРЛАГЫН БАРИМТ", name: "Зарлагын баримт" },
  income: { title: "ОРЛОГЫН БАРИМТ", name: "Орлогын баримт" },
};

// Тухайн гүйлгээнд баримт гаргах боломжтой эсэх (admin: орлогын баримтад)
export function documentAvailable(payment, type) {
  if (!EXTERNAL_METHODS.includes(payment.method)) return false;
  if (type === "invoice") return true;
  return payment.status === "PAID";
}

export const paymentVerifyUrl = (paymentId) =>
  `${(process.env.AUTH_URL ?? "").replace(/\/$/, "")}/verify/payment/${paymentId}?s=${signValue(PURPOSE, paymentId)}`;

export const isValidPaymentSignature = (paymentId, signature) => verifyValueSignature(PURPOSE, paymentId, signature);

// Баримтад шаардлагатай бүх мэдээлэлтэй төлбөр (имэйл, хэвлэх, шалгах хуудсанд)
export async function loadPaymentDocument(id) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      organization: {
        select: { id: true, name: true, registerNumber: true, customerNumber: true, address: true, email: true, phone: true },
      },
      subscription: { select: { packageName: true } },
      redemption: { select: { coupon: { select: { code: true } } } },
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

// Баримт хүлээн авагчид: хүсэлт гаргасан хэрэглэгч ба байгууллагын идэвхтэй админууд.
// Хэн ч байхгүй бол байгууллагын имэйл.
export async function documentRecipients(payment) {
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

const party = (payment, title = null) => {
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
  ${title ? `<div style="margin-top:16px;font-size:12px;font-weight:bold;color:#374151">${e(title)}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:${title ? 4 : 16}px">
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
      <td style="${cell}">${e(paymentPurpose(payment))} (${e(payment.reference)})</td>
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

const signatures = (rows) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px">
    <tr>${rows
      .map(
        ([role, name]) => `<td style="width:50%;font-size:12px;padding-right:16px">
        ${e(role)}: ____________________<br><span style="${label}">${e(name ?? "")}</span>
      </td>`,
      )
      .join("")}</tr>
  </table>`;

// Цуцлагдсан, татгалзсан нэхэмжлэхийг хэвлэхэд анхааруулна
const voidBanner = (payment) =>
  ["CANCELLED", "REJECTED"].includes(payment.status)
    ? `<p style="margin-top:12px;padding:8px 10px;background:#fee2e2;color:#991b1b;font-size:13px;font-weight:bold">
        ХҮЧИНГҮЙ: энэ нэхэмжлэх ${payment.status === "CANCELLED" ? "цуцлагдсан" : "татгалзагдсан"}. Төлбөр бүү төлнө үү.</p>`
    : "";

const layout = (body) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827;padding:16px">
  ${body}
  <p style="margin-top:24px;font-size:11px;color:#9ca3af">VerdecX · Энэ баримт системээс автоматаар үүссэн. НӨАТ-ын цахим баримт (e-barimt) биш.</p>
</div>`;

const qrAttachment = async (url) => ({
  filename: "verify-qr.png",
  content: await QRCode.toBuffer(url, { width: 240, margin: 1 }),
  cid: "verify-qr",
});

const textLines = (lines) => lines.filter((line) => line !== null && line !== undefined).join("\n");

// ---- Нэхэмжлэх ----

async function renderInvoice(payment) {
  const [system, bankAccounts] = await Promise.all([getSystemInfo(), activeBankAccounts()]);
  const url = paymentVerifyUrl(payment.id);
  const qpay = payment.qpayInvoice ?? null;
  // Хэтэвч цэнэглэлтийг QPay, банкны аль нэгээр төлж болно. Багцын QPay төлбөрийг зөвхөн QPay-ээр.
  const bankAllowed = payment.method === "BANK_TRANSFER" || payment.purpose === "WALLET_TOPUP";
  const attachments = [await qrAttachment(url)];
  if (qpay?.qrImage) {
    attachments.push({ filename: "qpay-qr.png", content: Buffer.from(qpay.qrImage, "base64"), cid: "qpay-qr" });
  }
  const effect = payment.purpose === "WALLET_TOPUP" ? "хэтэвч цэнэглэгдэнэ" : "багц идэвхжинэ";

  const qpayBlock = qpay
    ? `
    <td style="width:50%;vertical-align:top;padding:12px;border:1px solid #e5e7eb">
      <div style="font-weight:bold;margin-bottom:8px">${bankAllowed ? "1. " : ""}QPay-ээр төлөх</div>
      ${qpay.qrImage ? `<img src="cid:qpay-qr" width="170" height="170" alt="QPay QR" style="display:block">` : ""}
      <div style="font-size:12px;color:#374151;margin-top:6px">Банкны аппаараа QR кодыг уншуулна. Төлөгдмөгц ${effect}.</div>
      ${qpay.shortUrl ? `<div style="margin-top:6px"><a href="${e(qpay.shortUrl)}" style="color:#2563eb;font-size:12px">${e(qpay.shortUrl)}</a></div>` : ""}
    </td>`
    : "";
  const bankBlock = bankAllowed
    ? `
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
      <div style="font-size:12px;background:#fef3c7;padding:6px 8px">Гүйлгээний утгад <b style="font-family:monospace">${e(payment.reference)}</b> гэж заавал бичнэ үү. Админ шалгаж баталгаажуулсны дараа ${effect}.</div>
    </td>`
    : "";

  const html = layout(`
    ${header(system, DOCUMENT_TYPES.invoice.title, payment.reference, "Огноо", payment.createdAt)}
    ${voidBanner(payment)}
    ${party(payment)}
    ${items(payment)}
    ${
      payment.status === "PENDING"
        ? `<div style="margin-top:20px;font-size:14px;font-weight:bold">Төлбөр төлөх</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse"><tr>${qpayBlock}${bankBlock}</tr></table>`
        : payment.status === "PAID"
          ? `<p style="margin-top:16px;font-size:13px;padding:8px 10px;background:#ecfdf5;color:#065f46">Төлөгдсөн: ${e(formatDateTime(payment.paidAt))}</p>`
          : ""
    }
    ${verifyBlock(url, "QR кодыг утсаараа уншуулж энэ нэхэмжлэх VerdecX системээс гарсан эсэх, төлбөрийн төлвийг шалгана уу.")}
  `);
  const text = textLines([
    `НЭХЭМЖЛЭХ № ${payment.reference}`,
    `Байгууллага: ${payment.organization.name}`,
    `${paymentPurpose(payment)}: ${formatMoney(payment.amount)}`,
    "",
    payment.status === "PENDING" && qpay?.shortUrl ? `QPay-ээр төлөх: ${qpay.shortUrl}` : null,
    ...(payment.status === "PENDING" && bankAllowed
      ? [...bankAccounts.map((account) => `${account.bankName}: ${account.accountNumber} (${account.accountName})`), `Гүйлгээний утга: ${payment.reference}`]
      : []),
    "",
    `Баримт шалгах: ${url}`,
  ]);
  return { subject: `Нэхэмжлэх № ${payment.reference}: ${formatMoney(payment.amount)}`, html, text, attachments };
}

// ---- Зарлагын баримт (байгууллагад) ----

async function renderReceipt(payment) {
  const system = await getSystemInfo();
  const url = paymentVerifyUrl(payment.id);
  const topup = payment.purpose === "WALLET_TOPUP";
  const html = layout(`
    ${header(system, DOCUMENT_TYPES.receipt.title, payment.reference, "Төлсөн огноо", payment.paidAt)}
    ${party(payment)}
    ${items(payment, [
      ["Төлбөрийн хэрэгсэл", paidVia(payment)],
      ["Төлөв", "Төлөгдсөн"],
      ...(topup && payment.balanceAfter != null ? [["Хэтэвчний үлдэгдэл", formatMoney(payment.balanceAfter)]] : []),
    ])}
    <p style="margin-top:16px;font-size:13px;padding:10px;background:#ecfdf5;color:#065f46">
      ${e(formatMoney(payment.amount))} төлбөр хүлээн авч, ${topup ? "байгууллагын хэтэвч цэнэглэгдлээ" : "багц идэвхжлээ"}.
    </p>
    ${verifyBlock(url, "QR кодыг утсаараа уншуулж энэ баримт VerdecX системээс гарсан эсэхийг шалгана уу.")}
  `);
  const text = textLines([
    `ЗАРЛАГЫН БАРИМТ № ${payment.reference}`,
    `Байгууллага: ${payment.organization.name}`,
    `${paymentPurpose(payment)}: ${formatMoney(payment.amount)}`,
    `Төлсөн: ${formatDateTime(payment.paidAt)} (${paidVia(payment)})`,
    topup && payment.balanceAfter != null ? `Хэтэвчний үлдэгдэл: ${formatMoney(payment.balanceAfter)}` : null,
    "",
    `Баримт шалгах: ${url}`,
  ]);
  return {
    subject: `Зарлагын баримт № ${payment.reference}: ${formatMoney(payment.amount)} төлөгдлөө`,
    html,
    text,
    attachments: [await qrAttachment(url)],
  };
}

// ---- Орлогын баримт (системийн админд: мөнгө хүлээн авсныг баталгаажуулна) ----

async function renderIncome(payment) {
  const system = await getSystemInfo();
  const url = paymentVerifyUrl(payment.id);
  const html = layout(`
    ${header(system, DOCUMENT_TYPES.income.title, payment.reference, "Хүлээн авсан огноо", payment.paidAt)}
    ${party(payment, "Төлөгч")}
    ${items(payment, [
      ["Төлбөрийн хэрэгсэл", paidVia(payment)],
      ["Хүлээн авсан", system.name],
      ...(payment.reviewedBy ? [["Баталгаажуулсан", `${personName(payment.reviewedBy)} · ${formatDateTime(payment.reviewedAt)}`]] : []),
    ])}
    ${signatures([
      ["Хүлээн авсан", payment.reviewedBy ? personName(payment.reviewedBy) : null],
      ["Нягтлан бодогч", null],
    ])}
    ${verifyBlock(url, "QR кодыг утсаараа уншуулж энэ гүйлгээ VerdecX системд бүртгэлтэй, төлөгдсөн эсэхийг шалгана уу.")}
  `);
  return { subject: `Орлогын баримт № ${payment.reference}`, html, text: "", attachments: [await qrAttachment(url)] };
}

const RENDERERS = { invoice: renderInvoice, receipt: renderReceipt, income: renderIncome };

export const renderDocument = (type, payment) => RENDERERS[type](payment);

// Хэвлэх хуудсанд: cid зургийг data URI болгож нэг HTML болгоно
export async function renderDocumentHtml(type, payment) {
  const { html, attachments } = await renderDocument(type, payment);
  return attachments.reduce(
    (out, file) => out.replaceAll(`cid:${file.cid}`, `data:image/png;base64,${file.content.toString("base64")}`),
    html,
  );
}

// ---- Имэйлээр илгээх ----

// Нэхэмжлэх, зарлагын баримтыг байгууллагын хүлээн авагчид илгээнэ. Буцаах: илгээсэн хаягууд
export async function sendDocument(type, payment) {
  const to = await documentRecipients(payment);
  if (!to.length) return [];
  await sendMail({ to, ...(await renderDocument(type, payment)) });
  return to;
}

// Автомат илгээлт (хэтэвч цэнэглэх үед). Алдаа нь төлбөрийн урсгалыг зогсоохгүй (лог л үлдээнэ).
async function sendAutomatic(paymentId, type) {
  try {
    const payment = await loadPaymentDocument(paymentId);
    if (!payment || payment.purpose !== "WALLET_TOPUP" || !documentAvailable(payment, type)) return false;
    if (type === "invoice" && payment.status !== "PENDING") return false;
    return (await sendDocument(type, payment)).length > 0;
  } catch (error) {
    console.error(`[documents] ${type} ${paymentId}:`, error.message);
    return false;
  }
}

export const sendTopupInvoice = (paymentId) => sendAutomatic(paymentId, "invoice");

export const sendTopupReceipt = (paymentId) => sendAutomatic(paymentId, "receipt");
