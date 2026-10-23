import nodemailer from "nodemailer";

// SMTP (.env): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, MAIL_FROM_NAME.
// Gmail бол 587 порт (STARTTLS) эсвэл 465 (SSL), нууц үгийн оронд 16 тэмдэгттэй App Password.
// Бүх орчинд SMTP-ээр илгээнэ. SMTP_HOST хоосон бол алдаа өгнө.
let transporter;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    // Олон имэйлийг (төлбөрийн мэдэгдэл г.м.) нэг холболтоор илгээнэ
    pool: true,
    maxConnections: 3,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          // Gmail App Password-ийг "xxxx xxxx xxxx xxxx" хэлбэрээр хуулсан байж болно
          pass: (process.env.SMTP_PASSWORD ?? "").replace(/\s/g, ""),
        }
      : undefined,
  });
  return transporter;
}

const fromAddress = () => {
  const address = process.env.MAIL_FROM || process.env.SMTP_USER;
  const name = process.env.MAIL_FROM_NAME || "e-KYC";
  return { name, address };
};

export async function sendMail({ to, subject, text, html }) {
  const smtp = getTransporter();
  if (!smtp) throw new Error("SMTP тохируулаагүй байна (.env-ийн SMTP_HOST)");

  try {
    return await smtp.sendMail({ from: fromAddress(), to, subject, text, html });
  } catch (error) {
    console.error(`[mail] failed "${subject}" → ${to}:`, error.message);
    throw error;
  }
}

// SMTP холболт ба нэвтрэлтийг (имэйл илгээхгүйгээр) шалгана
export async function verifyMailTransport() {
  const smtp = getTransporter();
  if (!smtp) return { ok: false, error: "SMTP_HOST тохируулаагүй" };
  try {
    await smtp.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function sendPasswordResetMail(to, resetUrl) {
  await sendMail({
    to,
    subject: "Нууц үг сэргээх",
    text: `Нууц үгээ сэргээхийн тулд дараах линк дээр дарна уу:\n${resetUrl}\n\nХэрэв та хүсэлт илгээгээгүй бол энэ и-мэйлийг үл тоомсорлоно уу.`,
    html: `<p>Нууц үгээ сэргээхийн тулд <a href="${resetUrl}">энд дарна уу</a>.</p><p>Хэрэв та хүсэлт илгээгээгүй бол энэ и-мэйлийг үл тоомсорлоно уу.</p>`,
  });
}

export async function sendOtpMail(to, code, minutes) {
  await sendMail({
    to,
    subject: `Баталгаажуулах код: ${code}`,
    text: `Таны баталгаажуулах код: ${code}\n\nКод ${minutes} минутын турш хүчинтэй.\nХэрэв та хүсэлт илгээгээгүй бол энэ и-мэйлийг үл тоомсорлоно уу.`,
    html: `<p>Таны баталгаажуулах код:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Код ${minutes} минутын турш хүчинтэй.</p><p>Хэрэв та хүсэлт илгээгээгүй бол энэ и-мэйлийг үл тоомсорлоно уу.</p>`,
  });
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

// Мэдэгдлийн нийтлэг загвар: гарчиг, мөрүүд, товч. Хэрэглэгчийн оруулсан утгыг escape хийнэ.
export function renderMessage({ heading, lines, action }) {
  const text = [heading, "", ...lines, ...(action ? ["", `${action.label}: ${action.url}`] : [])].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
  <p style="font-size:18px;font-weight:bold;margin:0 0 16px">${escapeHtml(heading)}</p>
  ${lines.map((line) => `<p style="margin:0 0 8px;line-height:1.5">${escapeHtml(line)}</p>`).join("\n  ")}
  ${
    action
      ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(action.label)}</a></p>`
      : ""
  }
  <p style="margin-top:32px;font-size:12px;color:#6b7280">e-KYC · Энэ мэдэгдэл автоматаар илгээгдсэн.</p>
</div>`;
  return { text, html };
}
