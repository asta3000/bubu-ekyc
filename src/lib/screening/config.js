// Хориг тулгалтын онооны тохиргоо. Анхны утгууд; админ /managements/settings-ээс өөрчилнө.
// Client (тохиргооны form) болон server (matcher) хоёуланд ашиглана.
export const DEFAULT_MATCHING = {
  // Хоёр үгийн Jaro-Winkler төстэй байдал энэ босгоос доош бол penalty-гаар үржүүлнэ
  tokenMatch: 0.9,
  tokenPenalty: 0.5,
  // Хайсан нэрийн үгс жагсаалтын нэрэнд хэр таарах (жин), үлдсэн нь эсрэг чиглэл
  queryWeight: 0.75,
  // Үг нийлсэн/салсан ("Abdulrahman" = "Abdul Rahman") харьцуулалт: уртын харьцааны доод хязгаар, жин
  joinedMinRatio: 0.8,
  joinedWeight: 0.95,
  // Нэрийн оноон дээр нэмэх/хасах оноо
  dobExact: 8,
  dobYear: 5,
  dobMismatch: -20,
  countryMatch: 5,
  countryMismatch: -5,
  // Тулгах form-ын анхны босго
  defaultThreshold: 85,
  // Нэрнээс хасах утгагүй үгс (LLC, ХХК г.м., латинаар)
  stopWords: [
    "llc", "ltd", "limited", "inc", "co", "corp", "corporation", "company", "jsc", "ojsc", "pjsc",
    "cjsc", "ooo", "oao", "zao", "ao", "gmbh", "sa", "plc", "the", "of", "and", "llp", "fze", "fzco",
    "khkh", "kkhk", "hhk", "tkhk", "kk",
  ],
};

// Тохиргооны form-ын талбарууд (бүлгээр)
export const MATCHING_FIELDS = [
  {
    group: "Нэрийн оноо (0-100)",
    fields: [
      { key: "tokenMatch", label: "Үгийн тохирлын босго", min: 0.5, max: 1, step: 0.01, hint: "Хоёр үгийн төстэй байдал (0-1) үүнээс бага бол бараг тохироогүйд тооцно" },
      { key: "tokenPenalty", label: "Тохироогүй үгийн коэффициент", min: 0, max: 1, step: 0.05, hint: "Босгоос бага үгийн төстэй байдлыг үүгээр үржүүлнэ" },
      { key: "queryWeight", label: "Хайсан нэрийн жин", min: 0.5, max: 1, step: 0.05, hint: "Хайсан нэрийн үгс олдох нь чухал; үлдсэн жин нь жагсаалтын нэрийн илүү үгсэд" },
      { key: "joinedMinRatio", label: "Нийлсэн үгийн уртын харьцаа", min: 0.5, max: 1, step: 0.05, hint: "Үгийн тоо зөрүүтэй нэрийг зайгүй нийлүүлж харьцуулах доод уртын харьцаа" },
      { key: "joinedWeight", label: "Нийлсэн үгийн жин", min: 0.5, max: 1, step: 0.01, hint: "Нийлүүлсэн харьцуулалтын оноог үүгээр үржүүлнэ" },
    ],
  },
  {
    group: "Нэмэх / хасах оноо",
    fields: [
      { key: "dobExact", label: "Төрсөн огноо таарсан", min: 0, max: 30, step: 1 },
      { key: "dobYear", label: "Төрсөн он таарсан", min: 0, max: 30, step: 1 },
      { key: "dobMismatch", label: "Төрсөн огноо зөрсөн", min: -50, max: 0, step: 1 },
      { key: "countryMatch", label: "Улс таарсан", min: 0, max: 30, step: 1 },
      { key: "countryMismatch", label: "Улс зөрсөн", min: -50, max: 0, step: 1 },
    ],
  },
  {
    group: "Босго",
    fields: [{ key: "defaultThreshold", label: "Анхны тохирлын босго (%)", min: 60, max: 100, step: 1, hint: "Тулгах form дээр анх сонгогдох босго" }],
  },
];

// Нэрийн оноонд нэмэгдэж болох хамгийн их оноо (нэр нь үүгээр л босгод хүрэх эсэхийг урьдчилан шүүнэ)
export const maxBonus = (config) => Math.max(config.dobExact, config.dobYear, 0) + Math.max(config.countryMatch, 0);
