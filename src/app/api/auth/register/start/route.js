import { prisma } from "@/lib/prisma";
import { issueOtp, otpErrorResponse } from "@/lib/otp";
import { parseBody } from "@/lib/api";
import { emailOnlySchema } from "@/lib/validations";

// Бүртгэлийн 1-р алхам: и-мэйл рүү OTP илгээнэ
export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, emailOnlySchema);
  if (invalid) return invalid;

  const { email } = data;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return Response.json(
      { errors: { email: "Энэ и-мэйл хаягаар бүртгэл үүссэн байна" } },
      { status: 409 },
    );
  }

  try {
    const { resendIn } = await issueOtp(email, "REGISTER");
    return Response.json({ email, resendIn });
  } catch (error) {
    return otpErrorResponse(error);
  }
}
