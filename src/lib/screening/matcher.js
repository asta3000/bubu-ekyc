import { prisma } from "@/lib/prisma";
import { maxBonus } from "./config";
import { countryNames } from "./countries";
import { getMatchingConfig } from "./matching-settings";
import { getCustomEntries, getSanctionsIndex, identifierKey, parseBirthDates } from "./sanctions-index";
import { nameScore, prepareName, transliterations } from "./text";

const MAX_RESULTS = 50;

// Нэрийн оноонд нэмэх, хасах оноо (админы тохиргооноос). Нэр нь гол шалгуур, бусад нь нарийвчилна.
const adjustments = (config) => ({
  dob: { exact: config.dobExact, year: config.dobYear, mismatch: config.dobMismatch },
  country: { match: config.countryMatch, mismatch: config.countryMismatch },
});

function checkBirthDate(query, entry) {
  if (!query) return null;
  if (!entry.years.size && !entry.dates.size) return "unknown";
  if (query.date && entry.dates.has(query.date)) return "exact";
  if (entry.years.has(query.year)) return "year";
  return "mismatch";
}

function checkCountry(query, entry) {
  if (!query) return null;
  if (entry.countryText.trim() === "" && !entry.countryCodes.size) return "unknown";
  if (entry.countryCodes.has(query.code)) return "match";
  return query.names.some((name) => entry.countryText.includes(` ${name} `)) ? "match" : "mismatch";
}

const hasIdentifier = (key, entry) =>
  entry.identifierKeys.has(key) || entry.identifierKeys.has(key.replace(/^[A-Z]+/, ""));

// Тулгалт хийнэ. Нэр заавал, бусад нь заавал биш. sources-д CUSTOM байвал
// organizationId-ийн өөрийн жагсаалтуудыг нэмж тулгана.
// Буцаах: [{ entryId, score, nameScore, matchedName, checks: { birthDate, country, identifier } }]
export async function findMatches({ name, subjectType, birthDate, country, identifier, sources, threshold, organizationId }) {
  const config = await getMatchingConfig();
  const stopWords = new Set(config.stopWords);
  const adjust = adjustments(config);
  const bonus = maxBonus(config);
  const queryNames = transliterations(name).map((n) => prepareName(n, stopWords)).filter((n) => n.tokens.length);
  const dob = birthDate ? parseBirthDates([birthDate]) : null;
  const queryDob = dob && { year: [...dob.years][0], date: [...dob.dates][0] };
  const queryCountry = country ? { code: country, names: countryNames(country) } : null;
  const queryId = identifierKey(identifier);

  const entries = await getSanctionsIndex(stopWords);
  const custom = sources.includes("CUSTOM") && organizationId ? await getCustomEntries(organizationId, stopWords) : [];

  const matches = [];
  for (const entry of [...entries, ...custom]) {
    if (!sources.includes(entry.source)) continue;
    // CSL нь хувь хүн, байгууллагыг ялгадаггүй тул төрлөөр шүүхгүй
    if (subjectType && entry.subjectType !== subjectType && entry.source !== "US_CSL") continue;

    const idMatch = Boolean(queryId) && hasIdentifier(queryId, entry);

    let best = { score: 0, name: null };
    for (const candidate of entry.names) {
      for (const query of queryNames) {
        const score = nameScore(query, candidate, config);
        if (score > best.score) best = { score, name: candidate.text };
      }
    }
    if (!idMatch && best.score + bonus < threshold) continue;

    const checks = {
      birthDate: checkBirthDate(queryDob, entry),
      country: checkCountry(queryCountry, entry),
      identifier: queryId ? (idMatch ? "match" : "nomatch") : null,
    };
    const score = idMatch
      ? 100
      : Math.max(0, Math.min(100, best.score + (adjust.dob[checks.birthDate] ?? 0) + (adjust.country[checks.country] ?? 0)));
    if (!idMatch && score < threshold) continue;

    matches.push({ entryId: entry.id, score, nameScore: best.score, matchedName: best.name, checks });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

// Тохирлуудыг бичлэгийн дэлгэрэнгүйтэй нь хадгалах хуулбар болгоно. Жагсаалт дараа
// шинэчлэгдсэн ч тухайн үед юутай тулгасан нь түүхэнд үлдэнэ.
export async function withEntryDetails(matches) {
  const entries = await prisma.sanctionEntry.findMany({
    where: { id: { in: matches.map((m) => m.entryId) } },
    select: {
      id: true,
      source: true,
      externalId: true,
      subjectType: true,
      name: true,
      aliases: true,
      birthDates: true,
      birthPlaces: true,
      nationalities: true,
      addresses: true,
      identifiers: true,
      programs: true,
      remarks: true,
      listedAt: true,
      list: { select: { name: true } },
    },
  });
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return matches
    .filter((match) => byId.has(match.entryId))
    .map((match) => {
      const { id, list, ...entry } = byId.get(match.entryId);
      return {
        ...match,
        entry: { ...entry, listedAt: entry.listedAt?.toISOString() ?? null, listName: list?.name ?? null },
      };
    });
}
