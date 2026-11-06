import { CODES } from "@/lib/screening/countries";
import { clean, identifier, join, parseCsv, unique } from "../utils";

// Японы Сангийн яамны (MOF) хөрөнгө царцаах этгээдийн нэгдсэн жагсаалт (UTF-8 CSV).
// Багана бүр япон, англи хосоор. Улсын нэр ихэнхдээ зөвхөн японоор байдаг тул тулгалт
// англи нэрээр хийгддэг: Intl-ээр англи болгоно, танихгүй бол хасна (буруу "зөрсөн" гэж
// оноо хасахаас сэргийлнэ).

const japaneseNames = new Intl.DisplayNames(["ja"], { type: "region" });
const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRIES = new Map(CODES.map((code) => [japaneseNames.of(code), englishNames.of(code)]));
// Жагсаалтад Intl-ээс өөрөөр бичигддэг нэрс
const COUNTRY_ALIASES = {
  "ロシア連邦": "RU",
  "朝鮮民主主義人民共和国": "KP",
  "北朝鮮": "KP",
  "イラン・イスラム共和国": "IR",
  "サウディ・アラビア": "SA",
  "グルジア": "GE",
  "クウェイト": "KW",
  "コンゴ共和国": "CG",
  "シリア・アラブ共和国": "SY",
  "コンゴ民主共和国": "CD",
  "ベラルーシ共和国": "BY",
  "英国": "GB",
  "米国": "US",
  "アメリカ合衆国": "US",
  "中国": "CN",
  "中華人民共和国": "CN",
  "香港": "HK",
  "アラブ首長国連邦": "AE",
  "トルコ": "TR",
  "ミャンマー": "MM",
  "パレスチナ": "PS",
  "スーダン共和国": "SD",
  "イラク共和国": "IQ",
  "リビア": "LY",
  "イエメン共和国": "YE",
  "ウクライナ": "UA",
};
for (const [name, code] of Object.entries(COUNTRY_ALIASES)) COUNTRIES.set(name, englishNames.of(code));

const englishCountry = (name) => {
  const text = clean(name);
  return COUNTRIES.get(text) ?? COUNTRIES.get(text.replace(/(共和国|連邦|王国|国)$/, "")) ?? "";
};

// "a; b；c" → [a, b, c]
const split = (value) => (clean(value) ? clean(value).split(/\s*[;；]\s*/) : []);

// Бүтэн өргөнтэй тоо, тэмдэгтийг энгийн болгож цэвэрлэнэ
const text = (value) => clean(value?.normalize("NFKC"));

// "1941/8/20", "1970年", "1975年3月21日" → "1941-08-20", "1970", "1975-03-21"
function birthDates(value) {
  const dates = [];
  for (const [, y, m, d] of value.matchAll(/(\d{4})\s*(?:\/|年)\s*(?:(\d{1,2})\s*(?:\/|月)\s*(?:(\d{1,2})\s*日?)?)?/g)) {
    dates.push([y, m?.padStart(2, "0"), m && d?.padStart(2, "0")].filter(Boolean).join("-"));
  }
  return unique(dates);
}

// Эхний огноо: "2001年10月6日（...改訂）" эсвэл "2002.3.1 2012.3.27改訂"
function firstDate(value) {
  const match = value.match(/(\d{4})\s*[年.]\s*(\d{1,2})\s*[月.]\s*(\d{1,2})/);
  return match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
}

export function parseJapan(csv) {
  const [header, ...rows] = parseCsv(csv);
  const columns = header.map(clean);
  const records = rows
    .filter((row) => row.length === columns.length)
    .map((row) => {
      const get = (name) => text(row[columns.indexOf(name)]);
      const country = (ja, en) => unique([...split(get(en)), ...split(get(ja)).map(englishCountry)]);
      const englishName = get("氏名（英語）");
      const japaneseName = get("氏名（日本語）");

      return {
        externalId: get("番号"),
        subjectType: get("個人・団体") === "団体" ? "ENTITY" : "INDIVIDUAL",
        name: englishName || japaneseName,
        aliases: unique([
          englishName ? japaneseName : "",
          ...["別名・別称", "旧称", "確定に十分でない別名"].flatMap((field) => [
            ...split(get(`${field}（英語）`)),
            ...split(get(`${field}（日本語）`)),
          ]),
        ]),
        birthDates: birthDates(get("生年月日")),
        birthPlaces: unique([get("出生地（英語）") || get("出生地（日本語）")]),
        nationalities: country("国籍（日本語）", "国籍（英語）"),
        addresses: unique([
          join([
            get("住所・所在地（都市その他の情報）（英語）").replace(/,$/, ""),
            get("住所・所在地（国）（英語）") || englishCountry(get("住所・所在地（国）（日本語）")),
          ]),
        ]),
        identifiers: unique([
          ...split(get("旅券番号")).map((value) => identifier("Passport", value)),
          ...split(get("身分証番号")).map((value) => identifier("ID", value)),
          identifier("UN ref", get("国連参照番号")),
        ]),
        programs: unique([get("区分") && `MOF 区分 ${get("区分")}`]),
        remarks: join([get("役職（英語）") || get("役職（日本語）"), get("その他の情報")], ". ") || null,
        listedAt: firstDate(get("リスト掲載日")) ?? firstDate(get("告示日付")),
      };
    });

  return { publishedAt: null, records };
}
