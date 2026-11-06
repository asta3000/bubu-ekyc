import ExcelJS from "exceljs";
import { clean, join, unique } from "../utils";

// Австралийн DFAT-ын нэгдсэн хоригийн жагсаалт (XLSX, "Consolidated List" хуудас).
// Нэг этгээд олон мөрөөр: "2" үндсэн нэр, "2a", "2b" ... нэрийн хувилбар, эх бичиг.
// Мөр бүрт этгээдийн бусад талбар давтагдана. "Weak" (сул) нэрийн хувилбар нь
// DFAT-ын зааврын дагуу дангаараа таних хангалтгүй тул хуурамч тохирол үүсгэхгүйн тулд алгасна.

const SUBJECT_TYPES = { Individual: "INDIVIDUAL", Entity: "ENTITY", Vessel: "VESSEL" };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const isoDate = (date) => date.toISOString().slice(0, 10);

// Date, 1961 (тоо), "Approximately 1963, 30/01/1972" г.м. → ["1963", "1972-01-30"]
function birthDates(value) {
  if (value instanceof Date) return [isoDate(value)];
  if (typeof value === "number") return [String(value)];
  const text = clean(value);
  const dates = [];
  for (const [, d, m, y] of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    dates.push(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  // Өдөр, сартай огнооны оныг давхар оруулахгүй
  const withoutFull = text.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, "");
  for (const [year] of withoutFull.matchAll(/\b(19|20)\d{2}\b/g)) dates.push(year);
  return unique(dates);
}

// "Listed on 25 January 2001 (...)", "Listed by UN 1267 Committee on 6 Oct. 2001" → эхний огноо
function listedDate(value) {
  const match = clean(value).match(/\b(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})\b/);
  const month = match && MONTHS[match[2].toLowerCase()];
  return month ? new Date(Date.UTC(+match[3], month - 1, +match[1])) : null;
}

const split = (value) => clean(value).split(/\s*;\s*/).filter(Boolean);

// Буцаах: { publishedAt, records }. XLSX тул Buffer авна.
export async function parseAustralia(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Consolidated List") ?? workbook.worksheets[0];
  const header = sheet.getRow(1).values.map((value) => clean(value));
  const column = (name) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`DFAT жагсаалтад "${name}" багана олдсонгүй. Файлын бүтэц өөрчлөгдсөн байж магадгүй.`);
    return index;
  };
  const columns = Object.fromEntries(
    [
      "Reference",
      "Name of Individual or Entity",
      "Type",
      "Name Type",
      "Alias Strength",
      "Date of Birth",
      "Place of Birth",
      "Citizenship",
      "Address",
      "Additional Information",
      "Listing Information",
      "IMO Number",
      "Committees",
      "Control Date",
    ].map((name) => [name, column(name)]),
  );

  // Лавлах дугаарын тоон хэсгээр (2, 2a, 2b → 2) бүлэглэнэ
  const groups = new Map();
  let publishedAt = null;
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const get = (name) => row.values[columns[name]];
    const base = clean(get("Reference")).match(/^\d+/)?.[0];
    if (!base) return;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(get);
    const control = get("Control Date");
    if (control instanceof Date && (!publishedAt || control > publishedAt)) publishedAt = control;
  });

  const records = [...groups.entries()].flatMap(([reference, rows]) => {
    const primary = rows.find((get) => clean(get("Name Type")) === "Primary Name");
    if (!primary) return [];
    const imo = clean(primary("IMO Number"));
    const subjectType = SUBJECT_TYPES[clean(primary("Type"))] ?? "ENTITY";

    return [
      {
        externalId: reference,
        subjectType,
        name: clean(primary("Name of Individual or Entity")),
        aliases: unique(
          rows
            .filter((get) => get !== primary && clean(get("Alias Strength")) !== "Weak")
            .map((get) => get("Name of Individual or Entity")),
        ),
        birthDates: subjectType === "INDIVIDUAL" ? birthDates(primary("Date of Birth")) : [],
        birthPlaces: unique([primary("Place of Birth")]),
        nationalities: unique(split(primary("Citizenship"))),
        addresses: unique(split(primary("Address"))),
        identifiers: imo ? [`IMO: ${imo}`] : [],
        programs: unique(split(primary("Committees"))),
        remarks: join([primary("Additional Information"), primary("Listing Information")], " ") || null,
        listedAt: listedDate(primary("Listing Information")),
      },
    ];
  });

  return { publishedAt, records };
}
