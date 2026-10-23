import { unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireSessionApi } from "@/lib/session";
import { profileSchema } from "@/lib/validations";

// Нэвтэрсэн хэрэглэгч овог, нэр, холбоо барих мэдээллээ засна
export async function PATCH(request) {
  const { error, session } = await requireSessionApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, profileSchema);
  if (invalid) return invalid;

  await prisma.user.update({ where: { id: session.user.id }, data });
  // Token-ийг DB-ээс дахин уншуулж navbar г.м.-д шинэ нэр харагдана
  await unstable_update({});
  return Response.json({ message: "Мэдээлэл хадгалагдлаа" });
}
