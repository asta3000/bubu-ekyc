import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_TOKEN_MAX_AGE = Number(process.env.ACCESS_TOKEN_MAX_AGE ?? 900);
export const REFRESH_TOKEN_MAX_AGE = Number(process.env.REFRESH_TOKEN_MAX_AGE ?? 2592000);
export const PASSWORD_RESET_TOKEN_MAX_AGE = Number(
  process.env.PASSWORD_RESET_TOKEN_MAX_AGE ?? 3600,
);

export const EMAIL_VERIFICATION_TOKEN_MAX_AGE = Number(
  process.env.EMAIL_VERIFICATION_TOKEN_MAX_AGE ?? 1800,
);

export const nowInSeconds = () => Math.floor(Date.now() / 1000);

// Нууц үгийн hash-аас гаргасан богино хэвлэмж. Нууц үг солигдоход өөрчлөгдөх тул
// хуучин session болон ашигласан сэргээх token-ууд хүчингүй болно.
// Google-ээр бүртгүүлсэн хэрэглэгч нууц үггүй (null) байж болно.
export function passwordFingerprint(passwordHash) {
  return createHash("sha256")
    .update(passwordHash ?? "")
    .digest("base64url")
    .slice(0, 16);
}

// Зориулалт бүрт тусдаа түлхүүр гаргаж, нэг төрлийн token-ийг нөгөөд ашиглахаас сэргийлнэ
function sign(purpose, payload) {
  const key = createHash("sha256")
    .update(`${purpose}:${process.env.AUTH_SECRET}`)
    .digest();
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function createSignedToken(purpose, data, maxAge) {
  const payload = Buffer.from(
    JSON.stringify({ ...data, exp: nowInSeconds() + maxAge }),
  ).toString("base64url");
  return `${payload}.${sign(purpose, payload)}`;
}

// Хүчинтэй бол payload буцаана, үгүй бол null
function verifySignedToken(purpose, token) {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(purpose, payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < nowInSeconds()) return null;
    return data;
  } catch {
    return null;
  }
}

export const createPasswordResetToken = (user) =>
  createSignedToken(
    "password-reset",
    { sub: user.id, pwd: passwordFingerprint(user.password) },
    PASSWORD_RESET_TOKEN_MAX_AGE,
  );

// { sub, pwd } эсвэл null
export const verifyPasswordResetToken = (token) => verifySignedToken("password-reset", token);

// OTP баталгаажсаны дараа бүртгэлийн сүүлийн алхамд и-мэйлийг баталгаажсан гэж нотолно
export const createEmailVerificationToken = (email) =>
  createSignedToken("email-verification", { email }, EMAIL_VERIFICATION_TOKEN_MAX_AGE);

// { email } эсвэл null
export const verifyEmailVerificationToken = (token) =>
  verifySignedToken("email-verification", token);

// Хугацаагүй гарын үсэг (хэвлэсэн баримтын QR г.м.). id-г таахаас сэргийлнэ.
export const signValue = (purpose, value) => sign(purpose, String(value));

export function verifyValueSignature(purpose, value, signature) {
  const expected = Buffer.from(sign(purpose, String(value)));
  const actual = Buffer.from(String(signature ?? ""));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
