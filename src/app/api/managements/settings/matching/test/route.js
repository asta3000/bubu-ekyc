import { parseBody } from "@/lib/api";
import { DEFAULT_MATCHING } from "@/lib/screening/config";
import { getMatchingConfig } from "@/lib/screening/matching-settings";
import { explainNameScore, prepareName, transliterations } from "@/lib/screening/text";
import { requireAdminApi } from "@/lib/session";
import { matchingTestSchema } from "@/lib/validations";

// Хоёр нэрийн оноог задаргаатай нь тооцно. config өгвөл (хадгалаагүй form-ын утга) түүгээр,
// үгүй бол хадгалсан тохиргоогоор. Кирилл нэрийг тулгалтын адил латин хувилбаруудаар оролдоно.
export async function POST(request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, matchingTestSchema);
  if (invalid) return invalid;

  const config = data.config ? { ...DEFAULT_MATCHING, ...data.config } : await getMatchingConfig();
  const stopWords = new Set(config.stopWords);
  const candidate = prepareName(data.candidate, stopWords);

  let best = null;
  for (const variant of transliterations(data.query)) {
    const query = prepareName(variant, stopWords);
    const result = { query, ...explainNameScore(query, candidate, config) };
    if (!best || result.score > best.score) best = result;
  }
  return Response.json({ ...best, candidate });
}
