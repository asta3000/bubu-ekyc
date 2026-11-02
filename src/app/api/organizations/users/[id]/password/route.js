import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { logAudit } from "@/lib/audit/log";
import { requireOrgAdminApi } from "@/lib/organization-access";
import { setPasswordSchema } from "@/lib/validations";
import { findManagedUser } from "../../shared";

// Байгууллагын админ хэрэглэгчийн нууц үгийг шинээр тохируулна. Нууц үг солигдоход тухайн
// хэрэглэгчийн бүх session дуусна (token-ийн нууц үгийн хэвлэмж таарахгүй болно).
// И-мэйлээ баталгаажуулаагүй (Google г.м.) хэрэглэгч ч нууц үгээр нэвтрэх боломжтой болно.
export async function POST(request, ctx) {
  const { error, session, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, setPasswordSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const { user, error: denied } = await findManagedUser(session, organization, id);
  if (denied) return denied;

  await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(data.password, 12), isEmailVerified: true },
  });
  await logAudit({
    action: "user.password_set",
    actor: session.user,
    organizationId: organization.id,
    entity: { type: "User", id },
    summary: `${user.email} хэрэглэгчийн нууц үгийг шинээр тохируулав`,
  });
  return Response.json({ message: "Нууц үг солигдлоо" });
}
