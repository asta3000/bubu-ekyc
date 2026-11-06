import { clean, join, list, toDate } from "../utils";

// Хувь хүний нэрний өмнөх хүндэтгэлийн үг ("MR. JOHN DOE" → "JOHN DOE")
const HONORIFIC = /^(MR|MRS|MS|MISS|DR|ENG|M\/S)\.?\s+/i;

// Хугацаагүй хасалтыг 2999-12-31 гэж бичдэг
const PERMANENT_YEAR = "2999";

// Дэлхийн банкны санхүүжилтэд оролцох эрхгүй компани, хувь хүн (JSON).
// Хугацаа нь дууссан хасалтыг алгасна.
export function parseWorldBank(text) {
  const items = list(JSON.parse(text).response?.ZPROCSUPP);
  const today = new Date().toISOString().slice(0, 10);

  const records = items
    .filter((item) => !item.DEBAR_TO_DATE || item.DEBAR_TO_DATE >= today)
    .map((item) => {
      const until = item.DEBAR_TO_DATE?.startsWith(PERMANENT_YEAR) ? "хугацаагүй" : clean(item.DEBAR_TO_DATE);
      return {
        externalId: clean(item.SUPP_ID),
        subjectType: item.SUPP_TYPE_CODE === "I" ? "INDIVIDUAL" : "ENTITY",
        name: clean(item.SUPP_NAME).replace(HONORIFIC, ""),
        aliases: [],
        birthDates: [],
        birthPlaces: [],
        nationalities: [],
        addresses: [
          join([item.SUPP_ADDR, item.SUPP_CITY, item.SUPP_STATE_CODE, item.SUPP_ZIP_CODE, item.COUNTRY_NAME]),
        ].filter(Boolean),
        identifiers: [],
        programs: [join(["World Bank debarment", item.INELIGIBLY_STATUS], " · ")],
        remarks: join([item.DEBAR_REASON, `${clean(item.DEBAR_FROM_DATE)} – ${until}`], ". ") || null,
        listedAt: toDate(item.DEBAR_FROM_DATE),
      };
    });

  const refreshed = items[0]?.LAST_REFRESH_DATE;
  return { publishedAt: refreshed ? new Date(refreshed) : null, records };
}
