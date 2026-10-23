// QPay Merchant API v2 (https://developer.qpay.mn). Нэхэмжлэх үүсгэж QR харуулна,
// төлөгдсөн эсэхийг payment/check-ээр шалгана. Callback-д найдахгүй, үргэлж шалгана.
const BASE_URL = (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2").replace(/\/$/, "");

export class QpayError extends Error {}

export const isQpayConfigured = () =>
  Boolean(process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE);

// Токеныг хугацаа дуустал дахин ашиглана
let token = { value: null, expiresAt: 0 };

async function accessToken() {
  if (token.value && Date.now() < token.expiresAt) return token.value;
  const credentials = Buffer.from(`${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`).toString("base64");
  const body = await request("/auth/token", { method: "POST", headers: { Authorization: `Basic ${credentials}` } }, false);
  // expires_in нь Unix секунд (эсвэл үлдсэн секунд) байдаг; 1 минутын өмнө шинэчилнэ
  const expires = Number(body.expires_in) || 0;
  const expiresAt = expires > 1e9 ? expires * 1000 : Date.now() + expires * 1000;
  token = { value: body.access_token, expiresAt: expiresAt - 60_000 };
  return token.value;
}

async function request(path, init, authorized = true) {
  if (!isQpayConfigured()) throw new QpayError("QPay тохируулаагүй байна");
  const headers = { "Content-Type": "application/json", ...init.headers };
  if (authorized) headers.Authorization = `Bearer ${await accessToken()}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(30_000), cache: "no-store" });
  } catch {
    throw new QpayError("QPay-тэй холбогдож чадсангүй");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new QpayError(`QPay: ${body.message ?? body.error ?? `HTTP ${res.status}`}`);
  return body;
}

// Нэхэмжлэх: { invoice_id, qr_text, qr_image (base64 PNG), qPay_shortUrl, urls: [{ name, logo, link }] }
export const createInvoice = ({ reference, amount, description, callbackUrl }) =>
  request("/invoice", {
    method: "POST",
    body: JSON.stringify({
      invoice_code: process.env.QPAY_INVOICE_CODE,
      sender_invoice_no: reference,
      invoice_receiver_code: "terminal",
      invoice_description: description,
      amount,
      callback_url: callbackUrl,
    }),
  });

// Нэхэмжлэхээр төлсөн дүн
export async function paidAmount(invoiceId) {
  const body = await request("/payment/check", {
    method: "POST",
    body: JSON.stringify({ object_type: "INVOICE", object_id: invoiceId, offset: { page_number: 1, page_limit: 100 } }),
  });
  return Number(body.paid_amount ?? 0);
}

export const cancelInvoice = (invoiceId) =>
  request(`/invoice/${encodeURIComponent(invoiceId)}`, { method: "DELETE" }).catch(() => null);
