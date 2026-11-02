import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logAuthEvent } from "@/lib/auth-log";
import { createUserWithOrganization, DUPLICATE_NAME } from "@/lib/organizations";
import {
  EMAIL_VERIFICATION_EXPIRED,
  REGISTER_ORGANIZATION_COOKIE,
  verifyEmailVerificationToken,
} from "@/lib/tokens";
import { parseBody } from "@/lib/api";
import { registerOrganizationSchema, registerSchema } from "@/lib/validations";

const DUPLICATE_EMAIL = "Энэ и-мэйл хаягаар бүртгэл үүссэн байна";

// Бүртгэлийн 4-р алхам: баталгаажсан и-мэйлээр хэрэглэгчийг 1-р алхамд сонгосон
// байгууллагатай нь үүсгэнэ (createUserWithOrganization).
export async function POST(request) {
  const { data, error: invalid } = await parseBody(
    request,
    registerSchema.extend({ organization: registerOrganizationSchema }),
  );
  if (invalid) return invalid;

  const { verificationToken, firstName, lastName, contact, password, organization } = data;
  const verified = verifyEmailVerificationToken(verificationToken);
  if (!verified) return Response.json({ errors: { form: EMAIL_VERIFICATION_EXPIRED } }, { status: 400 });

  const { email } = verified;
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return Response.json({ errors: { form: DUPLICATE_EMAIL } }, { status: 409 });

  let result;
  try {
    result = await createUserWithOrganization(
      organization,
      { firstName, lastName, contact, email, isEmailVerified: true, password: await bcrypt.hash(password, 12) },
      { id: true, email: true, firstName: true, lastName: true, contact: true, role: true },
    );
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    // Зэрэг илгээсэн хүсэлт шалгалтын дараа ижил и-мэйл эсвэл байгууллагын нэрээр үүсгэсэн
    const target = String(error.meta?.target ?? error.message);
    if (target.includes("name")) return Response.json({ errors: { organization: DUPLICATE_NAME } }, { status: 409 });
    return Response.json({ errors: { form: DUPLICATE_EMAIL } }, { status: 409 });
  }
  // Байгууллагын алдааг 1-р алхамд харуулахаар organization түлхүүрээр буцаана
  if (result.error) return Response.json({ errors: { organization: result.error } }, { status: 409 });

  (await cookies()).delete(REGISTER_ORGANIZATION_COOKIE);
  await logAuthEvent({ event: "REGISTER", email, userId: result.user.id, provider: "credentials" });
  return Response.json({ user: result.user }, { status: 201 });
}
