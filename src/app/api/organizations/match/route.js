import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { UsageError, attachUsage, consumeService, refundUsage, usageErrorResponse } from "@/lib/billing/usage";
import { requireOrganizationApi } from "@/lib/organization-access";
import { findMatches, withEntryDetails } from "@/lib/screening/matcher";
import { matchSchema } from "@/lib/validations";

// Хүйтэн эхлэлд хоригийн бүх бичлэгийг санах ойд ачаална
export const maxDuration = 60;

// Харилцагчийг хоригийн жагсаалттай тулгаж, үр дүнг түүхэнд хадгална.
// Багцын тоо (эсвэл задгай үнээр хэтэвч)-оос нэг удаа хасна.
export async function POST(request) {
  const { error, session, organization } = await requireOrganizationApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, matchSchema);
  if (invalid) return invalid;
  const { payOverage, ...query } = data;

  let usage;
  try {
    usage = await consumeService({
      organizationId: organization?.id,
      service: "SANCTION_SCREENING",
      userId: session.user.id,
      payOverage,
    });
  } catch (err) {
    if (err instanceof UsageError) return usageErrorResponse(err);
    throw err;
  }

  try {
    const results = await withEntryDetails(await findMatches(query));
    const screening = await prisma.screening.create({
      data: {
        ...query,
        userId: session.user.id,
        organizationId: organization?.id ?? null,
        matchCount: results.length,
        topScore: results[0]?.score ?? 0,
        results,
      },
      select: { id: true },
    });
    await attachUsage(usage, screening.id);
    return Response.json({ id: screening.id, results });
  } catch (err) {
    // Тулгалт хийгдээгүй тул ашиглалтыг буцаана
    await refundUsage(usage);
    throw err;
  }
}
