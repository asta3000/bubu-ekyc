import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { annualPlanSettingsSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Багцыг жилээр худалдан авах үеийн хөнгөлөлтийн хувь, хүчинтэй хоногийг хадгална.
// Дараагийн худалдан авалтаас үйлчилнэ.
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, annualPlanSettingsSchema);
  if (invalid) return invalid;

  const select = { annualDiscountRate: true, annualDurationDays: true };
  const before = await prisma.systemSetting.findUnique({ where: { id: "system" }, select });
  await prisma.systemSetting.upsert({
    where: { id: "system" },
    update: { ...data, updatedById: session.user.id },
    create: { id: "system", ...data, updatedById: session.user.id },
  });
  await logAudit({
    action: "settings.annual_plan",
    actor: session.user,
    organizationId: null,
    summary: `Жилийн багц: хөнгөлөлт ${data.annualDiscountRate}%, хугацаа ${data.annualDurationDays} хоног болгов`,
    changes: diffChanges(before, data),
  });
  return Response.json({ message: "Тохиргоо хадгалагдлаа" });
}
