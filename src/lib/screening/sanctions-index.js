import { prisma } from "@/lib/prisma";
import { normalize, prepareName } from "./text";

// Хоригийн бүх бичлэгийг (~40 мянга) тулгахад бэлэн хэлбэрээр санах ойд хадгална.
// Шинэ импорт хийгдэхэд (сүүлийн SUCCESS импорт өөрчлөгдөхөд) дахин ачаална.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// Төрсөн огнооны янз бүрийн бичлэгээс ("10 Dec 1948", "1948-12-10", "1945-1950") он, огноо гаргана
export function parseBirthDates(values) {
  const years = new Set();
  const dates = new Set();
  for (const value of values) {
    const text = String(value);
    let match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) dates.add(`${match[1]}-${match[2]}-${match[3]}`);
    match = text.match(/(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/);
    if (match && MONTHS[match[2].toLowerCase()]) {
      dates.add(`${match[3]}-${pad(MONTHS[match[2].toLowerCase()])}-${pad(match[1])}`);
    }
    // "1945-1950", "1960 to 1962" г.м. хугацааг бүх он болгож задлана
    match = text.match(/^(\d{4})\s*(?:-|to)\s*(\d{4})$/);
    if (match && +match[2] - +match[1] <= 20) {
      for (let year = +match[1]; year <= +match[2]; year++) years.add(year);
    }
    for (const year of text.match(/\b(1[89]\d{2}|20\d{2})\b/g) ?? []) years.add(+year);
  }
  return { years, dates };
}

// Бичиг баримтын дугаарыг харьцуулах түлхүүр: зөвхөн том үсэг, тоо. Тоогүй бол null.
export function identifierKey(value) {
  const key = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return key.length >= 5 && /\d/.test(key) ? key : null;
}

// "Passport: P04581926 (Afghanistan)" → ["P04581926", "04581926"]
function identifierKeys(identifiers) {
  const keys = new Set();
  for (const value of identifiers) {
    const number = value.slice(value.indexOf(": ") + 2).replace(/\s*\([^)]*\)\s*$/, "");
    const key = identifierKey(number);
    if (!key) continue;
    keys.add(key);
    // "IMO 9562233" г.м. угтвар үсгүүдгүй хувилбар
    const digits = key.replace(/^[A-Z]+/, "");
    if (digits.length >= 6) keys.add(digits);
  }
  return keys;
}

function prepareEntry(entry, stopWords) {
  const { years, dates } = parseBirthDates(entry.birthDates);
  const places = [...entry.nationalities, ...entry.birthPlaces, ...entry.addresses];
  return {
    id: entry.id,
    source: entry.source,
    subjectType: entry.subjectType,
    names: [entry.name, ...entry.aliases].map((name) => prepareName(name, stopWords)).filter((name) => name.tokens.length),
    years,
    dates,
    // Иргэншил, төрсөн газар, хаягийн нормчилсон текст (улс тулгахад)
    countryText: ` ${places.map(normalize).join(" ")} `,
    // CSL хаягийн төгсгөлийн ISO код ("Kabul, AF")
    countryCodes: new Set(entry.addresses.map((a) => a.match(/, ([A-Z]{2})$/)?.[1]).filter(Boolean)),
    identifierKeys: identifierKeys(entry.identifiers),
  };
}

let cache = { version: null, entries: [], loading: null };

async function load(version, stopWords) {
  const rows = await prisma.sanctionEntry.findMany({
    select: {
      id: true,
      source: true,
      subjectType: true,
      name: true,
      aliases: true,
      birthDates: true,
      birthPlaces: true,
      nationalities: true,
      addresses: true,
      identifiers: true,
    },
  });
  cache = { version, entries: rows.map((row) => prepareEntry(row, stopWords)), loading: null };
  return cache.entries;
}

// stopWords: Set. Админ утгагүй үгсийн жагсаалтыг өөрчилбөл нэрсийг дахин бэлтгэнэ.
export async function getSanctionsIndex(stopWords) {
  const latest = await prisma.sanctionImport.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { finishedAt: "desc" },
    select: { id: true },
  });
  const version = `${latest?.id ?? "empty"}:${[...stopWords].sort().join(",")}`;
  if (cache.version === version) return cache.entries;
  // Зэрэг ирсэн хүсэлтүүд нэг ачаалалтыг хүлээнэ
  if (cache.loading?.version !== version) {
    const promise = load(version, stopWords).catch((error) => {
      // Дараагийн хүсэлт дахин оролдоно
      cache.loading = null;
      throw error;
    });
    cache.loading = { version, promise };
  }
  return cache.loading.promise;
}
