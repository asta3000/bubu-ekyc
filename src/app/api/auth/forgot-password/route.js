import { prisma } from "@/lib/prisma";
import { logAuthEvent } from "@/lib/auth-log";
import { sendPasswordResetMail } from "@/lib/mail";
import { createPasswordResetToken } from "@/lib/tokens";
import { parseBody } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validations";

export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, forgotPasswordSchema);
  if (invalid) return invalid;

  const user = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true, email: true, password: true, status: true },
  });

  if (user?.status === "ACTIVE") {
    const baseUrl = process.env.AUTH_URL ?? new URL(request.url).origin;
    const resetUrl = new URL("/recovery", baseUrl);
    resetUrl.searchParams.set("token", createPasswordResetToken(user));
    // Илгээх алдаа нь бүртгэлтэй эсэхийг (зөвхөн бүртгэлтэй үед 500) задруулахгүйн тулд хариуг өөрчлөхгүй
    try {
      await sendPasswordResetMail(user.email, resetUrl.toString());
    } catch (error) {
      console.error("[mail] password reset:", error.message);
    }
  }

  await logAuthEvent({
    event: "PASSWORD_RESET_REQUESTED",
    email: data.email,
    userId: user?.id,
    // Линк илгээгээгүй шалтгаан
    reason: !user ? "user_not_found" : user.status !== "ACTIVE" ? "inactive" : null,
  });

  // Бүртгэлтэй эсэхийг задруулахгүйн тулд үргэлж ижил хариу буцаана
  return Response.json({
    message: "Хэрэв энэ хаягаар бүртгэл байгаа бол сэргээх линк илгээгдлээ.",
  });
}
