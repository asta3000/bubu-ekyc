import { clean, identifier, join, list, parseXml, unique } from "../utils";

const SUBJECT_TYPES = {
  Individual: "INDIVIDUAL",
  Entity: "ENTITY",
  Vessel: "VESSEL",
  Aircraft: "AIRCRAFT",
};

// OFAC нэрийг "ОВОГ, Нэр" хэлбэрээр бичдэг
const fullName = ({ firstName, lastName }) =>
  clean(firstName) ? `${clean(lastName)}, ${clean(firstName)}` : clean(lastName);

// "MM/DD/YYYY" → Date
function publishDate(value) {
  const match = clean(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? new Date(Date.UTC(+match[3], +match[1] - 1, +match[2])) : null;
}

// OFAC-ийн SDN болон Non-SDN (Consolidated) жагсаалт. Хоёулаа ижил XML бүтэцтэй.
export function parseOfac(text) {
  const root = parseXml(text).sdnList;

  const records = list(root.sdnEntry).map((item) => {
    const vessel = item.vesselInfo ?? {};
    return {
      externalId: clean(item.uid),
      subjectType: SUBJECT_TYPES[clean(item.sdnType)] ?? "ENTITY",
      name: fullName(item),
      aliases: unique(list(item.akaList?.aka).map(fullName)),
      birthDates: unique(list(item.dateOfBirthList?.dateOfBirthItem).map((d) => d.dateOfBirth)),
      birthPlaces: unique(list(item.placeOfBirthList?.placeOfBirthItem).map((p) => p.placeOfBirth)),
      nationalities: unique([
        ...list(item.nationalityList?.nationality).map((n) => n.country),
        ...list(item.citizenshipList?.citizenship).map((c) => c.country),
      ]),
      addresses: unique(
        list(item.addressList?.address).map((a) =>
          join([a.address1, a.address2, a.address3, a.city, a.stateOrProvince, a.postalCode, a.country]),
        ),
      ),
      identifiers: unique([
        ...list(item.idList?.id).map((id) => identifier(id.idType, id.idNumber, id.idCountry)),
        identifier("Call sign", vessel.callSign),
        identifier("Vessel type", vessel.vesselType),
        identifier("Flag", vessel.vesselFlag),
        identifier("Owner", vessel.vesselOwner),
      ]),
      programs: unique(list(item.programList?.program)),
      remarks: join([item.title, item.remarks], ". ") || null,
      listedAt: null,
    };
  });

  return { publishedAt: publishDate(root.publshInformation?.Publish_Date), records };
}
