import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { registrationSettingsSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Гэрээ байгуулаагүй байгууллагад бүртгүүлэх хэрэглэгчийн дээд тоог хадгална.
// Аль хэдийн бүртгэгдсэн хэрэглэгчдэд нөлөөлөхгүй, дараагийн бүртгэлээс үйлчилнэ.
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, registrationSettingsSchema);
  if (invalid) return invalid;

  const values = { uncontractedUserLimit: data.uncontractedUserLimit, updatedById: session.user.id };
  const before = await prisma.systemSetting.findUnique({ where: { id: "system" }, select: { uncontractedUserLimit: true } });
  await prisma.systemSetting.upsert({
    where: { id: "system" },
    update: values,
    create: { id: "system", ...values },
  });
  await logAudit({
    action: "settings.registration",
    actor: session.user,
    organizationId: null,
    summary: `Гэрээгүй байгууллагын хэрэглэгчийн дээд тоог ${values.uncontractedUserLimit} болгов`,
    changes: diffChanges(before, { uncontractedUserLimit: values.uncontractedUserLimit }),
  });
  return Response.json({ message: "Тохиргоо хадгалагдлаа" });
}
