import { parseBody } from "@/lib/api";
import { getMatchingConfig, resetMatchingConfig, saveMatchingConfig } from "@/lib/screening/matching-settings";
import { requireAdminApi } from "@/lib/session";
import { matchingSettingsSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Хориг тулгалтын онооны тохиргоог хадгална. Дараагийн тулгалтаас үйлчилнэ.
export async function PUT(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, matchingSettingsSchema);
  if (invalid) return invalid;

  const before = await getMatchingConfig();
  await saveMatchingConfig(data, session.user.id);
  await logAudit({
    action: "settings.matching",
    actor: session.user,
    organizationId: null,
    summary: "Хориг тулгалтын онооны тохиргоог өөрчлөв",
    changes: diffChanges(before, data),
  });
  return Response.json({ message: "Онооны тохиргоо хадгалагдлаа" });
}

// Анхны утгад буцаана
export async function DELETE() {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  await resetMatchingConfig();
  await logAudit({
    action: "settings.matching_reset",
    actor: session.user,
    organizationId: null,
    summary: "Хориг тулгалтын оноог анхны утгад буцаав",
  });
  return Response.json({ message: "Анхны утгад буцаалаа" });
}
