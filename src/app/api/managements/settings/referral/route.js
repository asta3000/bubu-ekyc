import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { referralSettingsSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Урьсан байгууллагыг урьсан байгууллагад (2-р шат) олгох хувийг хадгална.
// Цаашдын төлбөрөөс үйлчилнэ.
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, referralSettingsSchema);
  if (invalid) return invalid;

  const values = { referralSecondRate: data.secondRate, updatedById: session.user.id };
  const before = await prisma.systemSetting.findUnique({ where: { id: "system" }, select: { referralSecondRate: true } });
  await prisma.systemSetting.upsert({
    where: { id: "system" },
    update: values,
    create: { id: "system", ...values },
  });
  await logAudit({
    action: "settings.referral",
    actor: session.user,
    organizationId: null,
    summary: `Санал болголтын 2-р шатны хувийг ${values.referralSecondRate} болгов`,
    changes: diffChanges(before, { referralSecondRate: values.referralSecondRate }),
  });
  return Response.json({ message: "Тохиргоо хадгалагдлаа" });
}
