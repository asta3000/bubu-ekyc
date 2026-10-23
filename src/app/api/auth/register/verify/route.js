import { otpErrorResponse, verifyOtp } from "@/lib/otp";
import { logAuthEvent } from "@/lib/auth-log";
import { createEmailVerificationToken } from "@/lib/tokens";
import { parseBody } from "@/lib/api";
import { verifyOtpSchema } from "@/lib/validations";

// Бүртгэлийн 2-р алхам: OTP шалгаж, и-мэйл баталгаажсаныг нотлох token олгоно
export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, verifyOtpSchema);
  if (invalid) return invalid;

  const { email, code } = data;
  let valid;
  try {
    valid = await verifyOtp(email, "REGISTER", code);
  } catch (error) {
    return otpErrorResponse(error);
  }
  if (!valid) {
    await logAuthEvent({ event: "OTP_FAILED", email, reason: "register" });
    return Response.json(
      { errors: { code: "Код буруу эсвэл хугацаа нь дууссан байна" } },
      { status: 400 },
    );
  }

  await logAuthEvent({ event: "OTP_VERIFIED", email, reason: "register" });
  return Response.json({ verificationToken: createEmailVerificationToken(email) });
}
