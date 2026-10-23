import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { saveSystemSettings } from "@/lib/system";
import { systemSettingsSchema } from "@/lib/validations";

// Системийн холбоо барих мэдээллийг хадгална (хэвлэх тайлангийн толгой)
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, systemSettingsSchema);
  if (invalid) return invalid;

  await saveSystemSettings(data, session.user.id);
  return Response.json({ message: "Тохиргоо хадгалагдлаа" });
}
