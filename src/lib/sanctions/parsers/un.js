import { clean, identifier, join, list, parseXml, toDate, unique } from "../utils";

// НҮБ-ын Аюулгүйн Зөвлөлийн нэгдсэн жагсаалт (XML)
export function parseUn(text) {
  const root = parseXml(text).CONSOLIDATED_LIST;

  const common = (item, subjectType) => ({
    externalId: clean(item.DATAID),
    subjectType,
    programs: unique([item.UN_LIST_TYPE, item.REFERENCE_NUMBER]),
    remarks: clean(item.COMMENTS1) || null,
    listedAt: toDate(item.LISTED_ON),
  });

  const address = (a) => join([a.STREET, a.CITY, a.STATE_PROVINCE, a.ZIP_CODE, a.COUNTRY, a.NOTE]);

  const individuals = list(root.INDIVIDUALS?.INDIVIDUAL).map((item) => ({
    ...common(item, "INDIVIDUAL"),
    name: join([item.FIRST_NAME, item.SECOND_NAME, item.THIRD_NAME, item.FOURTH_NAME], " "),
    aliases: unique([
      ...list(item.INDIVIDUAL_ALIAS).map((alias) => alias.ALIAS_NAME),
      item.NAME_ORIGINAL_SCRIPT,
    ]),
    birthDates: unique(
      list(item.INDIVIDUAL_DATE_OF_BIRTH).map((date) =>
        date.FROM_YEAR ? `${clean(date.FROM_YEAR)}-${clean(date.TO_YEAR)}` : date.DATE ?? date.YEAR,
      ),
    ),
    birthPlaces: unique(
      list(item.INDIVIDUAL_PLACE_OF_BIRTH).map((place) =>
        join([place.CITY, place.STATE_PROVINCE, place.COUNTRY]),
      ),
    ),
    nationalities: unique(list(item.NATIONALITY?.VALUE)),
    addresses: unique(list(item.INDIVIDUAL_ADDRESS).map(address)),
    identifiers: unique(
      list(item.INDIVIDUAL_DOCUMENT).map((doc) =>
        identifier(
          join([doc.TYPE_OF_DOCUMENT, doc.TYPE_OF_DOCUMENT2], " / "),
          doc.NUMBER,
          doc.ISSUING_COUNTRY ?? doc.COUNTRY_OF_ISSUE,
        ),
      ),
    ),
  }));

  const entities = list(root.ENTITIES?.ENTITY).map((item) => ({
    ...common(item, "ENTITY"),
    name: clean(item.FIRST_NAME),
    aliases: unique(list(item.ENTITY_ALIAS).map((alias) => alias.ALIAS_NAME)),
    birthDates: [],
    birthPlaces: [],
    nationalities: [],
    addresses: unique(list(item.ENTITY_ADDRESS).map(address)),
    identifiers: [],
  }));

  return { publishedAt: root.dateGenerated ? new Date(root.dateGenerated) : null, records: [...individuals, ...entities] };
}
