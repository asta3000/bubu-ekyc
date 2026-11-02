import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { getSystemSettings, saveSystemSettings } from "@/lib/system";
import { systemSettingsSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Системийн холбоо барих мэдээллийг хадгална (хэвлэх тайлангийн толгой)
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, systemSettingsSchema);
  if (invalid) return invalid;

  const before = await getSystemSettings();
  await saveSystemSettings(data, session.user.id);
  await logAudit({
    action: "settings.system",
    actor: session.user,
    organizationId: null,
    summary: "Системийн холбоо барих мэдээллийг өөрчлөв",
    changes: diffChanges(before, data),
  });
  return Response.json({ message: "Тохиргоо хадгалагдлаа" });
}
