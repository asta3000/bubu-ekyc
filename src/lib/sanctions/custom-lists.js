import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { countryLabel } from "@/lib/screening/countries";

// Байгууллагын өөрийн хоригийн жагсаалт. Бичлэгүүдийг SanctionEntry-д source = CUSTOM,
// listId-тэйгээр хадгалснаар тулгалт, үр дүн, хэвлэх нь нийтийн жагсаалттай адил ажиллана.

// Байгууллагын жагсаалт (өөр байгууллагынх бол null)
export const findOwnList = (organizationId, id) =>
  prisma.sanctionList.findFirst({ where: { id, organizationId } });

// Хаягийн төгсгөлийн ", MN" нь улсын код (sanctions-index-ийн countryCodes)
const COUNTRY_SUFFIX = /, ([A-Z]{2})$/;

// Form-ын утгыг (sanctionListEntrySchema) SanctionEntry-ийн талбар болгоно
export function toEntryData({ subjectType, name, aliases, birthDate, country, address, identifier, remarks }) {
  const location = [address, country && `${countryLabel(country)}, ${country}`].filter(Boolean).join(", ");
  const fields = {
    subjectType,
    name,
    aliases,
    birthDates: birthDate ? [birthDate] : [],
    birthPlaces: [],
    nationalities: country ? [countryLabel(country)] : [],
    addresses: location ? [location] : [],
    identifiers: identifier ? [`ID: ${identifier}`] : [],
    programs: [],
    remarks,
  };
  return { ...fields, hash: JSON.stringify(fields) };
}

export const newEntryKeys = (listId) => ({ source: "CUSTOM", externalId: randomUUID(), listId });

// SanctionEntry-г form-ын анхны утга болгоно (засах үед)
export function toFormValues(entry) {
  const location = entry.addresses[0] ?? "";
  const country = location.match(COUNTRY_SUFFIX)?.[1] ?? "";
  const address = country ? location.replace(`${countryLabel(country)}, ${country}`, "").replace(/,\s*$/, "") : location;
  return {
    id: entry.id,
    subjectType: entry.subjectType,
    name: entry.name,
    aliases: entry.aliases.join("\n"),
    birthDate: entry.birthDates[0] ?? "",
    country,
    address,
    identifier: (entry.identifiers[0] ?? "").replace(/^ID: /, ""),
    remarks: entry.remarks ?? "",
  };
}
