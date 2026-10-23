import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAuthEvent } from "@/lib/auth-log";
import { passwordFingerprint, verifyPasswordResetToken } from "@/lib/tokens";
import { parseBody } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validations";

async function invalidToken(user, reason) {
  await logAuthEvent({ event: "PASSWORD_RESET_FAILED", email: user?.email, userId: user?.id, reason });
  return Response.json(
    { errors: { form: "Сэргээх линк хүчингүй эсвэл хугацаа нь дууссан байна" } },
    { status: 400 },
  );
}

export async function POST(request) {
  const { data: input, error: invalid } = await parseBody(request, resetPasswordSchema);
  if (invalid) return invalid;

  const data = verifyPasswordResetToken(input.token);
  if (!data) return invalidToken(null, "invalid_token");

  const user = await prisma.user.findUnique({
    where: { id: data.sub },
    select: { id: true, email: true, password: true, status: true },
  });
  // Нууц үг аль хэдийн солигдсон бол token-ийг дахин ашиглахыг хориглоно
  if (!user) return invalidToken(null, "user_not_found");
  if (user.status !== "ACTIVE") return invalidToken(user, "inactive");
  if (passwordFingerprint(user.password) !== data.pwd) return invalidToken(user, "token_used");

  await prisma.user.update({
    where: { id: user.id },
    // Сэргээх линк и-мэйл рүү очсон тул и-мэйлийг баталгаажсан гэж үзнэ
    data: { password: await bcrypt.hash(input.password, 12), isEmailVerified: true },
  });

  await logAuthEvent({ event: "PASSWORD_RESET", email: user.email, userId: user.id });
  return Response.json({ message: "Нууц үг амжилттай солигдлоо" });
}
