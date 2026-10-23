import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAuthEvent } from "@/lib/auth-log";
import { verifyEmailVerificationToken } from "@/lib/tokens";
import { parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validations";

// Бүртгэлийн 3-р алхам: баталгаажсан и-мэйлээр хэрэглэгч үүсгэнэ
export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, registerSchema);
  if (invalid) return invalid;

  const { verificationToken, firstName, lastName, contact, password } = data;
  const verified = verifyEmailVerificationToken(verificationToken);
  if (!verified) {
    return Response.json(
      { errors: { form: "И-мэйл баталгаажуулалтын хугацаа дууссан. Дахин эхлүүлнэ үү." } },
      { status: 400 },
    );
  }

  const { email } = verified;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return Response.json(
      { errors: { form: "Энэ и-мэйл хаягаар бүртгэл үүссэн байна" } },
      { status: 409 },
    );
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        contact,
        email,
        isEmailVerified: true,
        password: await bcrypt.hash(password, 12),
      },
      select: { id: true, email: true, firstName: true, lastName: true, contact: true, role: true },
    });
  } catch (error) {
    // Нэг token-оор зэрэг илгээсэн хүсэлт шалгалтын дараа давхар үүсгэх гэж оролдсон
    if (error?.code !== "P2002") throw error;
    return Response.json({ errors: { form: "Энэ и-мэйл хаягаар бүртгэл үүссэн байна" } }, { status: 409 });
  }

  await logAuthEvent({ event: "REGISTER", email, userId: user.id, provider: "credentials" });
  return Response.json({ user }, { status: 201 });
}
