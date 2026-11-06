import { clean, identifier, join, list, parseXml, toDate, unique } from "../utils";

const SUBJECT_TYPES = { individual: "INDIVIDUAL", entity: "ENTITY", object: "ENTITY" };

const byOrder = (a, b) => Number(a.order) - Number(b.order);

// Нэрийн хэсгүүдийг дарааллаар нь нийлүүлнэ. Өөр бичлэг (кирилл г.м.) бүрийг тусад нь буцаана.
function nameVariants(name) {
  const parts = list(name["name-part"]).sort(byOrder);
  const main = join(parts.map((part) => part.value), " ");
  const spellings = parts.flatMap((part) => list(part["spelling-variant"]).map((variant, index) => ({ index, part, variant })));
  // Хэсэг бүрийн N дэх бичлэгийг нийлүүлж бүтэн нэр болгоно ("Lukashenko Dmitri ...")
  const variants = [...new Set(spellings.map((s) => s.index))].map((index) =>
    join(parts.map((part) => clean(list(part["spelling-variant"])[index]) || part.value), " "),
  );
  return [main, ...variants];
}

const birthDate = (d) =>
  d.year ? [d.year, d.month?.padStart(2, "0"), d.day?.padStart(2, "0")].filter(Boolean).join("-") : "";

// Хамгийн сүүлийн өөрчлөлт нь "de-listed" бол жагсаалтаас хасагдсан
const isDelisted = (target) =>
  list(target.modification).sort((a, b) => clean(b["effective-date"]).localeCompare(clean(a["effective-date"])))[0]?.[
    "modification-type"
  ] === "de-listed";

// Швейцарийн SECO хоригийн нэгдсэн жагсаалт (XML). Хасагдсан бичлэгүүд хамт ирдэг тул алгасна.
export function parseSeco(text) {
  const root = parseXml(text)["swiss-sanctions-list"];

  const places = new Map(
    list(root.place).map((place) => [place.ssid, join([place.location, place.area, place.country])]),
  );
  // Хоригийн багц (sanctions-set) → хөтөлбөрийн англи нэр
  const programs = new Map();
  for (const program of list(root["sanctions-program"])) {
    const key = clean(list(program["program-key"]).find((item) => item.lang === "eng"));
    for (const set of list(program["sanctions-set"])) programs.set(set.ssid, key);
  }

  const records = list(root.target)
    .filter((target) => !isDelisted(target))
    .map((target) => {
      const kind = Object.keys(SUBJECT_TYPES).find((key) => target[key]);
      const subject = target[kind] ?? {};
      const identities = list(subject.identity).sort((a, b) => (b.main === "true") - (a.main === "true"));
      const names = identities.flatMap((identity) =>
        list(identity.name).sort((a, b) => (b["name-type"] === "primary-name") - (a["name-type"] === "primary-name")),
      );
      const [name, ...aliases] = unique(names.flatMap(nameVariants));
      const info = list(subject["other-information"]).map(clean);
      const imo = info.map((line) => line.match(/IMO(?: Number)?:?\s*(\d{7})/i)?.[1]).find(Boolean);
      const listed = list(target.modification).find((m) => m["modification-type"] === "listed");

      return {
        externalId: clean(target.ssid),
        subjectType: subject["object-type"] === "vessel" ? "VESSEL" : (SUBJECT_TYPES[kind] ?? "ENTITY"),
        name,
        aliases,
        birthDates: unique(identities.flatMap((identity) => list(identity["day-month-year"]).map(birthDate))),
        birthPlaces: unique(
          identities.flatMap((identity) => list(identity["place-of-birth"]).map((p) => places.get(p["place-id"]))),
        ),
        nationalities: unique(identities.flatMap((identity) => list(identity.nationality).map((n) => n.country))),
        addresses: unique(
          identities.flatMap((identity) =>
            list(identity.address).map((a) =>
              join([a["c-o"], a["address-details"], a["p-o-box"], a["zip-code"], places.get(a["place-id"])]),
            ),
          ),
        ),
        identifiers: unique([
          ...identities.flatMap((identity) =>
            list(identity["identification-document"]).map((doc) =>
              identifier(doc["document-type"], doc.number, doc.issuer),
            ),
          ),
          imo ? `IMO: ${imo}` : "",
        ]),
        programs: unique([programs.get(target["sanctions-set-id"]), ...list(target["foreign-identifier"])]),
        remarks: join([...list(subject.justification), ...info], " ") || null,
        listedAt: toDate(listed?.["effective-date"]),
      };
    });

  return { publishedAt: root.date ? new Date(root.date) : null, records };
}
