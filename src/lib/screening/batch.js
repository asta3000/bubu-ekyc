import ExcelJS from "exceljs";
import { SUBJECT_LABELS } from "@/app/organizations/_components/labels";
import { countryCode } from "./countries";

// Файлаар олноор тулгах: xlsx загвар ба уншилт. Мөр бүр тусдаа тулгалт болно.

export const BATCH_MAX_ROWS = 200;
export const BATCH_MAX_SIZE = 2 * 1024 * 1024;
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SHEET = "Тулгалт";
const COLUMNS = [
  { key: "subjectType", header: "Төрөл", width: 18 },
  { key: "name", header: "Нэр (заавал)", width: 36 },
  { key: "birthDate", header: "Төрсөн он / огноо", width: 20 },
  { key: "country", header: "Улс", width: 16 },
  { key: "identifier", header: "Бичиг баримтын дугаар", width: 26 },
];
const SUBJECT_NAMES = Object.values(SUBJECT_LABELS);

// Татаж авах загвар: толгой мөр, жишээ мөрүүд, төрлийн сонголт, заавар хуудас
export async function buildTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  sheet.addRows([
    { subjectType: "Хувь хүн", name: "Батын Дорж", birthDate: "1975-03-21", country: "MN", identifier: "УБ75032112" },
    { subjectType: "Хуулийн этгээд", name: "Golden Gobi LLC", country: "Монгол" },
  ]);
  // Огноог Excel огноо болгож хувиргахгүй, текстээр хадгална
  sheet.getColumn("birthDate").numFmt = "@";
  for (let row = 2; row <= BATCH_MAX_ROWS + 1; row++) {
    sheet.getCell(row, 1).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${SUBJECT_NAMES.join(",")}"`],
    };
  }

  const guide = workbook.addWorksheet("Заавар");
  guide.columns = [{ width: 26 }, { width: 80 }];
  guide.addRows([
    ["Багана", "Тайлбар"],
    ["Төрөл", `${SUBJECT_NAMES.join(", ")}. Хоосон бол бүх төрөлтэй тулгана.`],
    ["Нэр (заавал)", "Хувь хүний овог нэр эсвэл байгууллагын нэр. Кирилл, латин аль нь ч болно."],
    ["Төрсөн он / огноо", "Зөвхөн хувь хүнд: 1975 эсвэл 1975-03-21."],
    ["Улс", "ISO код (MN) эсвэл нэр (Монгол, Mongolia). Иргэншил эсвэл бүртгэлтэй улс."],
    ["Бичиг баримтын дугаар", "Паспорт, регистр, IMO г.м. Заавал биш."],
    [],
    ["Анхаар", `"${SHEET}" хуудсын жишээ мөрүүдийг устгаад өөрийн мэдээллийг оруулна. Нэг файлд ${BATCH_MAX_ROWS} хүртэл мөр.`],
    ["", "Мөр бүр нэг тулгалт болж багцын тооноос (эсвэл задгай үнээр хэтэвчнээс) хасагдана. Хоосон мөрийг алгасна."],
  ]);
  guide.getRow(1).font = { bold: true };
  guide.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  return workbook.xlsx.writeBuffer();
}

// Нүдний утгыг текст болгоно (огноо, тоо, томъёо, rich text)
function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
  }
  return String(value).trim();
}

const subjectCode = (text) =>
  Object.entries(SUBJECT_LABELS).find(([code, label]) => label === text || code === text.toUpperCase())?.[0];

// xlsx-ийг уншиж мөр бүрийг тулгалтын оролт болгоно. Танигдахгүй утгыг мөрийн алдаа
// болгоно (бусад мөрийг үргэлжлүүлнэ). Файл бүхэлдээ буруу бол { error }.
// Буцаах: { rows: [{ row, input }], errors: [{ row, name, message }] }
export async function parseBatchFile(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { error: "Файлыг уншиж чадсангүй. Загвараар бэлтгэсэн .xlsx файл оруулна уу." };
  }
  const sheet = workbook.getWorksheet(SHEET) ?? workbook.worksheets[0];
  if (!sheet) return { error: "Файлд хуудас алга" };

  const rows = [];
  const errors = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const [subject, name, birthDate, country, identifier] = COLUMNS.map((_, index) => cellText(row.getCell(index + 1).value));
    if (!subject && !name && !birthDate && !country && !identifier) return;

    const fail = (message) => errors.push({ row: number, name, message });
    const subjectType = subject ? subjectCode(subject) : null;
    if (subject && !subjectType) return fail(`Төрөл "${subject}" танигдсангүй`);
    const code = countryCode(country);
    if (country && !code) return fail(`Улс "${country}" танигдсангүй`);
    rows.push({ row: number, input: { subjectType, name, birthDate: birthDate || null, country: code, identifier: identifier || null } });
  });

  if (!rows.length && !errors.length) return { error: "Файлд тулгах мөр алга" };
  if (rows.length + errors.length > BATCH_MAX_ROWS) {
    return { error: `Нэг файлд ${BATCH_MAX_ROWS} хүртэл мөр оруулна` };
  }
  return { rows, errors };
}
