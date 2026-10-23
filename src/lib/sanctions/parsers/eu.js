import { clean, identifier, join, list, parseXml, toDate, unique } from "../utils";

const SUBJECT_TYPES = { person: "INDIVIDUAL", enterprise: "ENTITY" };

// ЕХ-ны тодорхойгүй улсыг "UNKNOWN" гэж бичдэг
const country = (value) => (clean(value) === "UNKNOWN" ? "" : value);

// ЕХ-ны санхүүгийн хоригийн нэгдсэн жагсаалт (XML 1.1)
export function parseEu(text) {
  const root = parseXml(text).export;

  const records = list(root.sanctionEntity).map((item) => {
    const names = list(item.nameAlias);
    const primary = names.find((alias) => alias.strong === "true") ?? names[0];
    const regulations = list(item.regulation);
    const births = list(item.birthdate);

    return {
      externalId: clean(item.logicalId),
      subjectType: SUBJECT_TYPES[item.subjectType?.code] ?? "ENTITY",
      name: clean(primary?.wholeName),
      aliases: unique(names.filter((alias) => alias !== primary).map((alias) => alias.wholeName)),
      birthDates: unique(births.map((birth) => birth.birthdate || birth.year)),
      birthPlaces: unique(
        births.map((birth) => join([birth.city, birth.place, birth.region, country(birth.countryDescription)])),
      ),
      nationalities: unique(list(item.citizenship).map((c) => country(c.countryDescription))),
      addresses: unique(
        list(item.address).map((a) =>
          join([a.street, a.poBox, a.city, a.zipCode, a.region, a.place, country(a.countryDescription)]),
        ),
      ),
      identifiers: unique(
        list(item.identification).map((doc) =>
          identifier(doc.identificationTypeDescription, doc.number, country(doc.countryDescription)),
        ),
      ),
      programs: unique([...regulations.map((r) => r.programme), item.euReferenceNumber]),
      remarks: join(list(item.remark), " ") || null,
      listedAt: toDate(regulations[0]?.publicationDate),
    };
  });

  return { publishedAt: root.generationDate ? new Date(root.generationDate) : null, records };
}
