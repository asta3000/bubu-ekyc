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

// Эх сурвалжаас татна. Том файлууд тул 2 минутын хугацаа өгнө.
export async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; e-KYC sanctions importer)" },
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} татахад алдаа гарлаа (HTTP ${res.status})`);
  return res.text();
}
