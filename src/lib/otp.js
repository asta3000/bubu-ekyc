import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendOtpMail } from "@/lib/mail";

const OTP_MAX_AGE = Number(process.env.OTP_MAX_AGE ?? 600);
const OTP_RESEND_COOLDOWN = Number(process.env.OTP_RESEND_COOLDOWN ?? 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
// Шинэ код авч оролдлогыг тэглэн brute-force хийхээс сэргийлж, и-мэйлийн нийт буруу
// оролдлогыг цагаар хязгаарлана (AuthLog-ийн OTP_FAILED-аар тоолно)
const OTP_MAX_HOURLY_FAILURES = Number(process.env.OTP_MAX_HOURLY_FAILURES ?? 10);
const HOUR_MS = 60 * 60 * 1000;

const hashCode = (email, purpose, code) =>
  createHmac("sha256", `otp:${process.env.AUTH_SECRET}`)
    .update(`${purpose}:${email}:${code}`)
    .digest("base64url");

export class OtpLockedError extends Error {
  constructor() {
    super("Олон удаа буруу код оруулсан тул 1 цагийн дараа дахин оролдоно уу");
  }
}

// Сүүлийн 1 цагт буруу оролдлого хязгаараас хэтэрсэн эсэх
async function isLocked(email) {
  const failures = await prisma.authLog.count({
    where: { email, event: "OTP_FAILED", createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  return failures >= OTP_MAX_HOURLY_FAILURES;
}

export class OtpCooldownError extends Error {
  constructor(retryAfter) {
    super("OTP cooldown");
    this.retryAfter = retryAfter;
  }
}

// Шинэ 6 оронтой код үүсгэж и-мэйлээр илгээнэ. Хуучин кодууд хүчингүй болно.
export async function issueOtp(email, purpose) {
  if (await isLocked(email)) throw new OtpLockedError();
  const last = await prisma.emailOtp.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const elapsed = Math.floor((Date.now() - last.createdAt.getTime()) / 1000);
    if (elapsed < OTP_RESEND_COOLDOWN) throw new OtpCooldownError(OTP_RESEND_COOLDOWN - elapsed);
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  await prisma.$transaction([
    prisma.emailOtp.deleteMany({ where: { email, purpose } }),
    prisma.emailOtp.create({
      data: {
        email,
        purpose,
        codeHash: hashCode(email, purpose, code),
        expiresAt: new Date(Date.now() + OTP_MAX_AGE * 1000),
      },
    }),
  ]);

  await sendOtpMail(email, code, Math.round(OTP_MAX_AGE / 60));
  return { resendIn: OTP_RESEND_COOLDOWN };
}

// Код зөв бол true буцааж устгана. Буруу оролдлого бүрийг тоолно.
// Цагийн хязгаар хэтэрсэн бол OtpLockedError (зөв код ч хүлээж авахгүй).
export async function verifyOtp(email, purpose, code) {
  if (await isLocked(email)) throw new OtpLockedError();
  const otp = await prisma.emailOtp.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt < new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) return false;

  const expected = Buffer.from(otp.codeHash);
  const actual = Buffer.from(hashCode(email, purpose, code));
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!valid) {
    await prisma.emailOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.emailOtp.deleteMany({ where: { email, purpose } });
  return true;
}

// Cooldown, түгжээний алдааг API хариу болгоно
export function otpErrorResponse(error) {
  if (error instanceof OtpLockedError) {
    return Response.json({ errors: { form: error.message } }, { status: 429 });
  }
  if (error instanceof OtpCooldownError) {
    return Response.json(
      {
        errors: { form: `Код дахин илгээхийн тулд ${error.retryAfter} секунд хүлээнэ үү` },
        resendIn: error.retryAfter,
      },
      { status: 429 },
    );
  }
  throw error;
}
