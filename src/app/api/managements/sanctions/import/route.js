import { parseBody } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { ImportInProgressError, importSanctions } from "@/lib/sanctions/importer";
import { importMessage } from "@/lib/sanctions/messages";
import { sanctionImportSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Том файл татаж, мянга мянган бичлэг бичих тул хугацааг уртасгана
export const maxDuration = 300;

// Нэг эх сурвалжийг импортлоно. Өөрчлөлтгүй бол "Шинэчлэлт байхгүй" гэж хариулна.
export async function POST(request) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, sanctionImportSchema);
  if (invalid) return invalid;

  try {
    const result = await importSanctions(data.source, session.user.id);
    await logAudit({
      action: "sanctions.import",
      actor: session.user,
      organizationId: null,
      summary: `${data.source}: ${importMessage(result)}`,
      metadata: { source: data.source, status: result.status },
    });
    return Response.json({ status: result.status, message: importMessage(result) });
  } catch (err) {
    if (err instanceof ImportInProgressError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    console.error(`[sanctions] ${data.source}:`, err);
    await logAudit({
      action: "sanctions.import",
      actor: session.user,
      organizationId: null,
      status: "FAILURE",
      summary: `${data.source}: ${err.message}`,
      metadata: { source: data.source },
    });
    return Response.json({ error: `Импорт амжилтгүй: ${err.message}` }, { status: 502 });
  }
}
