import { prisma } from "@/lib/prisma";
import { OtpCooldownError, OtpLockedError, issueOtp, otpErrorResponse } from "@/lib/otp";
import { parseBody } from "@/lib/api";
import { emailOnlySchema } from "@/lib/validations";

// Нэвтрэлтийн 1-р алхам: и-мэйл баталгаажаагүй бол OTP илгээнэ.
// Бүртгэлгүй и-мэйлд ч "password" буцааж, бүртгэлтэй эсэхийг задруулахгүй.
export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, emailOnlySchema);
  if (invalid) return invalid;

  const { email } = data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { isEmailVerified: true, status: true },
  });

  // Идэвхгүй бүртгэлд OTP илгээхгүй. Нууц үгийн алхамд тайлбар харуулна.
  if (!user || user.isEmailVerified || user.status !== "ACTIVE") {
    return Response.json({ email, next: "password" });
  }

  try {
    const { resendIn } = await issueOtp(email, "LOGIN");
    return Response.json({ email, next: "otp", resendIn });
  } catch (error) {
    // Саяхан илгээсэн код хүчинтэй хэвээр тул OTP алхам руу шилжүүлнэ
    if (error instanceof OtpCooldownError) {
      return Response.json({ email, next: "otp", resendIn: error.retryAfter });
    }
    if (error instanceof OtpLockedError) return otpErrorResponse(error);
    throw error;
  }
}
