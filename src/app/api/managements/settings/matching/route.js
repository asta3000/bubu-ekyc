import { parseBody } from "@/lib/api";
import { resetMatchingConfig, saveMatchingConfig } from "@/lib/screening/matching-settings";
import { requireAdminApi } from "@/lib/session";
import { matchingSettingsSchema } from "@/lib/validations";

// Хориг тулгалтын онооны тохиргоог хадгална. Дараагийн тулгалтаас үйлчилнэ.
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, matchingSettingsSchema);
  if (invalid) return invalid;

  await saveMatchingConfig(data, session.user.id);
  return Response.json({ message: "Онооны тохиргоо хадгалагдлаа" });
}

// Анхны утгад буцаана
export async function DELETE() {
  const { error } = await requireAdminApi();
  if (error) return error;

  await resetMatchingConfig();
  return Response.json({ message: "Анхны утгад буцаалаа" });
}
