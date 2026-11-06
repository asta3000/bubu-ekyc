import { prisma } from "@/lib/prisma";
import { fieldError } from "@/lib/api";
import {
  UsageError,
  attachUsage,
  consumeService,
  refundUsage,
  serviceAllowance,
  usageErrorResponse,
} from "@/lib/billing/usage";
import { includesQuota } from "@/lib/billing/services";
import { formatMoney } from "@/lib/format";
import { requireOrganizationApi } from "@/lib/organization-access";
import { BATCH_MAX_SIZE, parseBatchFile } from "@/lib/screening/batch";
import { findMatches, withEntryDetails } from "@/lib/screening/matcher";
import { fieldErrors, matchSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Мөр бүр тусдаа тулгалт тул олон мөртэй файлд хугацаа их шаардана
export const maxDuration = 300;

const CONCURRENCY = 5;
const optionsSchema = matchSchema.pick({ sources: true, threshold: true });
const rowSchema = matchSchema.pick({ name: true, subjectType: true, birthDate: true, country: true, identifier: true });

// Багцын тоо файлын мөрөнд хүрэлцэхгүй бол эхлээд хэрэглэгчээс зөвшөөрөл авна (юу ч тулгахгүй).
// Хүрэлцэхгүй тоог задгай үнээр хэтэвчнээс төлнө.
async function overageError(organizationId, count) {
  const { subscription, item, remaining } = await serviceAllowance(organizationId, "SANCTION_SCREENING");
  // Багцгүй, үйлчилгээ ороогүй бол эхний consumeService өөрөө алдаа өгнө
  if (!subscription || !item || !includesQuota(subscription.basePrice, item.quota) || remaining >= count) return null;
  // Задгай үнэ 0 бол асуулгүй үлдсэн тоогоор тулгаж, тоо дуусмагц QUOTA_LIMIT-ээр зогсоно
  if (item.unitPrice === 0) return null;
  const extra = count - remaining;
  return new UsageError(
    "QUOTA_EXHAUSTED",
    `Файлд ${count} мөр байгаа ч багцад ${remaining} тулгалт үлдсэн. ` +
      `Үлдсэн ${extra} мөрийг нэг бүр ${formatMoney(item.unitPrice)}-өөр (нийт ${formatMoney(extra * item.unitPrice)}) хэтэвчнээс төлнө.`,
    { unitPrice: item.unitPrice },
  );
}

// xlsx файлын мөр бүрийг хоригийн жагсаалттай тулгаж, тус бүрийг түүхэнд хадгална.
// Multipart: file, sources (олон), threshold, payOverage ("1").
// Мөр бүр багцын тооноос (эсвэл задгай үнээр хэтэвчнээс) нэг удаа хасагдана. Хэтэвчний
// үлдэгдэл, эсвэл задгай үнэгүй багцын тоо дуусвал тэр мөрөөс цааш тулгахгүй.
export async function POST(request) {
  const { error, session, organization } = await requireOrganizationApi();
  if (error) return error;

  const form = await request.formData().catch(() => null);
  if (!form) return fieldError("form", "Хүсэлт буруу байна");
  const options = optionsSchema.safeParse({ sources: form.getAll("sources"), threshold: form.get("threshold") });
  if (!options.success) return Response.json({ errors: fieldErrors(options.error) }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fieldError("file", "Файл сонгоно уу");
  if (file.size > BATCH_MAX_SIZE) return fieldError("file", "Файлын хэмжээ 2MB-аас ихгүй байна");
  const parsed = await parseBatchFile(Buffer.from(await file.arrayBuffer()));
  if (parsed.error) return fieldError("file", parsed.error);

  // Өөрийн жагсаалт зөвхөн байгууллагын хэрэглэгчийн тулгалтад (системийн админд биш)
  const customOrganizationId = session.user.role === "ADMIN" ? null : organization.id;
  const sources = options.data.sources.filter((source) => customOrganizationId || source !== "CUSTOM");
  if (!sources.length) return fieldError("sources", "Дор хаяж нэг жагсаалт сонгоно уу");

  const errors = [...parsed.errors];
  const rows = [];
  for (const { row, input } of parsed.rows) {
    const valid = rowSchema.safeParse(input);
    if (valid.success) rows.push({ row, query: valid.data });
    else errors.push({ row, name: input.name, message: valid.error.issues[0].message });
  }
  if (!rows.length) return Response.json({ results: [], errors });

  const payOverage = form.get("payOverage") === "1";
  if (organization && !payOverage) {
    const overage = await overageError(organization.id, rows.length);
    if (overage) return usageErrorResponse(overage);
  }

  // Мөрүүдийг зэрэг (CONCURRENCY) тулгана. Багцын тоо, хэтэвчний суутгал нөхцөлтэй тул
  // зэрэг ч хэтрэхгүй. Ашиглах боломжгүй болмогц (хэтэвч дуусах г.м.) шинэ мөр эхлүүлэхгүй.
  const results = [];
  let usageError = null;
  let next = 0;

  const screen = async ({ row, query }) => {
    let usage;
    try {
      usage = await consumeService({
        organizationId: organization?.id,
        service: "SANCTION_SCREENING",
        userId: session.user.id,
        payOverage,
      });
    } catch (err) {
      if (!(err instanceof UsageError)) throw err;
      usageError ??= err;
      errors.push({ row, name: query.name, message: `Тулгаагүй: ${err.message}` });
      return;
    }

    try {
      const matches = await withEntryDetails(
        await findMatches({ ...query, ...options.data, sources, organizationId: customOrganizationId }),
      );
      const screening = await prisma.screening.create({
        data: {
          ...query,
          sources,
          threshold: options.data.threshold,
          userId: session.user.id,
          organizationId: organization?.id ?? null,
          matchCount: matches.length,
          topScore: matches[0]?.score ?? 0,
          results: matches,
        },
        select: { id: true },
      });
      await attachUsage(usage, screening.id);
      results.push({ row, name: query.name, screeningId: screening.id, matchCount: matches.length, topScore: matches[0]?.score ?? 0 });
    } catch (err) {
      // Тулгалт хийгдээгүй тул ашиглалтыг буцааж, бусад мөрийг үргэлжлүүлнэ
      await refundUsage(usage);
      console.error("[match/batch]", err);
      errors.push({ row, name: query.name, message: "Тулгалт амжилтгүй болсон" });
    }
  };

  const worker = async () => {
    while (!usageError && next < rows.length) await screen(rows[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  // Нэг ч мөр тулгаагүй (багцгүй г.м.) бол энгийн тулгалт шиг алдаа буцаана
  if (usageError && !results.length) return usageErrorResponse(usageError);
  for (const rest of rows.slice(next)) {
    errors.push({ row: rest.row, name: rest.query.name, message: `Тулгаагүй: ${usageError.message}` });
  }

  errors.sort((a, b) => a.row - b.row);
  const matched = results.filter((item) => item.matchCount > 0).length;
  await logAudit({
    action: "screening.batch",
    actor: session.user,
    organizationId: organization?.id ?? null,
    summary: `"${file.name}" файлаар ${results.length} мөр тулгав (${matched} мөрт тохирол${errors.length ? `, ${errors.length} алдаатай` : ""})`,
    metadata: {
      fileName: file.name,
      sources,
      threshold: options.data.threshold,
      screeningIds: results.map((item) => item.screeningId),
      errors,
    },
  });
  return Response.json({ results, errors });
}
