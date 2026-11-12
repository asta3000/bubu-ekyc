import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { freePlanSettingsSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Үнэгүй багцыг сунгах дээд тоог хадгална. Дараагийн сунгалтаас үйлчилнэ.
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, freePlanSettingsSchema);
  if (invalid) return invalid;

  const values = { freeRenewalLimit: data.freeRenewalLimit, updatedById: session.user.id };
  const before = await prisma.systemSetting.findUnique({ where: { id: "system" }, select: { freeRenewalLimit: true } });
  await prisma.systemSetting.upsert({
    where: { id: "system" },
    update: values,
    create: { id: "system", ...values },
  });
  await logAudit({
    action: "settings.free_plan",
    actor: session.user,
    organizationId: null,
    summary: `Үнэгүй багцын сунгалтын дээд тоог ${values.freeRenewalLimit} болгов`,
    changes: diffChanges(before, { freeRenewalLimit: values.freeRenewalLimit }),
  });
  return Response.json({ message: "Тохиргоо хадгалагдлаа" });
}
