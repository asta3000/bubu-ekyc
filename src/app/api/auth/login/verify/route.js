import { prisma } from "@/lib/prisma";
import { otpErrorResponse, verifyOtp } from "@/lib/otp";
import { logAuthEvent } from "@/lib/auth-log";
import { parseBody } from "@/lib/api";
import { verifyOtpSchema } from "@/lib/validations";

// Нэвтрэлтийн 2-р алхам: OTP зөв бол и-мэйлийг баталгаажсан болгоно
export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, verifyOtpSchema);
  if (invalid) return invalid;

  const { email, code } = data;
  let valid;
  try {
    valid = await verifyOtp(email, "LOGIN", code);
  } catch (error) {
    return otpErrorResponse(error);
  }
  if (!valid) {
    await logAuthEvent({ event: "OTP_FAILED", email, reason: "login" });
    return Response.json(
      { errors: { code: "Код буруу эсвэл хугацаа нь дууссан байна" } },
      { status: 400 },
    );
  }

  // Код илгээсний дараа хэрэглэгч устгагдсан байж болно (update 500 алдаа өгөхгүйн тулд updateMany)
  const { count } = await prisma.user.updateMany({ where: { email }, data: { isEmailVerified: true } });
  if (!count) {
    return Response.json({ errors: { form: "Хэрэглэгч олдсонгүй" } }, { status: 404 });
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  await logAuthEvent({ event: "OTP_VERIFIED", email, userId: user?.id, reason: "login" });
  return Response.json({ next: "password" });
}
