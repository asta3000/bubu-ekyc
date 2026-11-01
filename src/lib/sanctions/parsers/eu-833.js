import { CONSOLIDATED_VERSION, ENTRIES, PARTS } from "../data/eu-833-annex-xlv";
import { toDate } from "../utils";

// "Chinggis Khaan Bank" → "chinggis-khaan-bank" (хавсралтад дугаар байхгүй тул нэрээр)
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ЕХ 833/2014 XLV хавсралт. Татах файлгүй, data/eu-833-annex-xlv.js-ээс уншина.
export function parseEu833() {
  const records = ENTRIES.map((entry) => ({
    externalId: `XLV-${entry.part}-${slug(entry.name)}`,
    subjectType: "ENTITY",
    name: entry.name,
    aliases: entry.aliases ?? [],
    birthDates: [],
    birthPlaces: [],
    nationalities: [],
    addresses: entry.country ? [entry.country] : [],
    identifiers: [],
    programs: [`Regulation (EU) No 833/2014, Annex XLV Part ${entry.part}`],
    remarks: `${PARTS[entry.part]}. 5ad зүйлийн гүйлгээний хориг ${entry.appliesFrom}-аас хэрэгжинэ.`,
    listedAt: toDate(entry.appliesFrom),
  }));
  return { publishedAt: toDate(CONSOLIDATED_VERSION), records };
}
