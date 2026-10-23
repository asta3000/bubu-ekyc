import bcrypt from "bcryptjs";
import { unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAuthEvent } from "@/lib/auth-log";
import { fieldError, parseBody } from "@/lib/api";
import { requireSessionApi } from "@/lib/session";
import { passwordFingerprint } from "@/lib/tokens";
import { changePasswordSchema } from "@/lib/validations";

// Нууц үг солих. Нууц үгтэй бол одоогийнхыг шалгана, Google-ээр бүртгүүлсэн
// нууц үггүй хэрэглэгч шинээр тохируулна.
export async function POST(request) {
  const { error, session } = await requireSessionApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, changePasswordSchema);
  if (invalid) return invalid;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, password: true },
  });
  if (!user) return Response.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

  if (user.password) {
    const valid = await bcrypt.compare(data.currentPassword ?? "", user.password);
    if (!valid) {
      await logAuthEvent({
        event: "PASSWORD_CHANGE_FAILED",
        email: user.email,
        userId: user.id,
        reason: "wrong_password",
      });
      return fieldError("currentPassword", "Одоогийн нууц үг буруу байна");
    }
  }

  const hash = await bcrypt.hash(data.password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
  await logAuthEvent({ event: "PASSWORD_CHANGED", email: user.email, userId: user.id });

  // Нууц үг солигдоход бусад төхөөрөмж дээрх session-ууд дуусна. Энэ session-ийг
  // шинэ хэвлэмжээр шинэчилж нэвтэрсэн хэвээр үлдээнэ.
  await unstable_update({ pwd: passwordFingerprint(hash) });
  return Response.json({ message: "Нууц үг солигдлоо" });
}
