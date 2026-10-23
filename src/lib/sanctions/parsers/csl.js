import { clean, identifier, join, list, toDate, unique } from "../utils";

const SUBJECT_TYPES = {
  Individual: "INDIVIDUAL",
  Entity: "ENTITY",
  Vessel: "VESSEL",
  Aircraft: "AIRCRAFT",
};

// АНУ-ын Consolidated Screening List (JSON). OFAC-ийн жагсаалтуудыг шууд OFAC-аас
// импортлодог тул энд зөвхөн бусад яамны (BIS Entity List, Denied Persons г.м.) хэсгийг авна.
export function parseCsl(text) {
  const results = JSON.parse(text).results ?? [];

  const records = results
    .filter((item) => !item.source?.includes("Treasury Department"))
    .map((item) => ({
      externalId: clean(item.id),
      subjectType: SUBJECT_TYPES[item.type] ?? "ENTITY",
      name: clean(item.name),
      aliases: unique(list(item.alt_names)),
      birthDates: unique(list(item.dates_of_birth)),
      birthPlaces: unique(list(item.places_of_birth)),
      nationalities: unique([...list(item.nationalities), ...list(item.citizenships)]),
      addresses: unique(
        list(item.addresses).map((a) => join([a.address, a.city, a.state, a.postal_code, a.country])),
      ),
      identifiers: unique(list(item.ids).map((id) => identifier(id.type, id.number, id.country))),
      // "Entity List (EL) - Bureau of Industry and Security" → "Entity List (EL)"
      programs: unique([item.source?.split(" - ")[0], ...list(item.programs)]),
      remarks: join([item.remarks, item.license_requirement, item.license_policy], ". ") || null,
      listedAt: toDate(item.start_date),
    }));

  return { publishedAt: null, records };
}
