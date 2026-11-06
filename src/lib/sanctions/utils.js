import { XMLParser } from "fast-xml-parser";

// Утгыг үргэлж массив болгоно (XML-д нэг элемент объект, олон бол массив болдог)
export const list = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

// Мөр цэвэрлэх: илүү зай, хоосон, "-0-" г.м. утгагүй утгыг хасна
export function clean(value) {
  // Attribute-тэй элемент { "#text": ... } хэлбэртэй ирнэ
  if (value != null && typeof value === "object") value = value["#text"];
  if (value == null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "-0-" || text.toLowerCase() === "na" ? "" : text;
}

// Хоосныг хасаж, давхардлыг арилгана
export const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];

// Хэсгүүдийг ", "-аар нийлүүлнэ (хаяг г.м.)
export const join = (parts, separator = ", ") => unique(parts).join(separator);

// "Төрөл: дугаар (улс)" хэлбэрийн таних тэмдэг. Дугааргүй бол хоосон.
export function identifier(type, number, country) {
  const value = clean(number);
  if (!value) return "";
  const suffix = clean(country) ? ` (${clean(country)})` : "";
  // OFAC зарим төрлийг "Secondary sanctions risk:" гэж төгсгөлд нь ":"-тай бичдэг
  const label = clean(type).replace(/:+$/, "") || "ID";
  return `${label}: ${value}${suffix}`;
}

// "yyyy-mm-dd" эсвэл "dd/mm/yyyy" → Date. Танихгүй бол null.
export function toDate(value) {
  const text = clean(value);
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return new Date(Date.UTC(+match[3], +match[2] - 1, +match[1]));
  return null;
}

// Бүх эх сурвалжид нэг тохиргоо: утгыг string хэвээр (паспортын эхний 0 алдагдахгүй)
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

export const parseXml = (text) => xmlParser.parse(text);

// RFC 4180 CSV → мөрүүдийн массив (талбар бүр string). Хашилт доторх таслал, мөр шилжилт,
// "" (давхар хашилт)-ыг зөв уншина. Эхний BOM-ыг хасна.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[i + 1] === '"') (field += '"'), i++;
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") row.push(field), (field = "");
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += char;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

// Эх сурвалжаас татна. Том файлууд тул анхдагчаар 2 минутын хугацаа өгнө.
// binary: XLSX г.м. файлыг Buffer-ээр буцаана (анхдагчаар текст).
export async function download(url, { headers = {}, timeout = 120_000, binary = false } = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VerdecX sanctions importer)", ...headers },
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} татахад алдаа гарлаа (HTTP ${res.status})`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}
