import { cookies } from "next/headers";
import { parseBody } from "@/lib/api";
import { checkRegisterOrganization } from "@/lib/organizations";
import {
  REGISTER_ORGANIZATION_COOKIE,
  REGISTER_ORGANIZATION_MAX_AGE,
  createRegisterOrganizationToken,
} from "@/lib/tokens";
import { registerOrganizationSchema } from "@/lib/validations";

// Бүртгэлийн 1-р алхам: байгууллагын мэдээллийг шалгана (юу ч үүсгэхгүй). Нэгдэх бол
// байгууллагын нэрийг буцаана. Google-ээр үргэлжлүүлбэл callback-д ашиглахаар
// шалгагдсан оролтыг гарын үсэгтэй cookie-д хадгална.
export async function POST(request) {
  const { data, error: invalid } = await parseBody(request, registerOrganizationSchema);
  if (invalid) return invalid;

  const { organization, errors } = await checkRegisterOrganization(data);
  if (errors) return Response.json({ errors }, { status: 409 });

  (await cookies()).set(REGISTER_ORGANIZATION_COOKIE, createRegisterOrganizationToken(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: REGISTER_ORGANIZATION_MAX_AGE,
    path: "/",
  });
  return Response.json({ organization });
}
