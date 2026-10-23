// Монгол Улсын регистрийн дугаар: 2 кирилл үсэг + 8 оронтой тоо (УБ90010112)
export const REGNUM_PATTERN = /^[А-ЯЁӨҮ]{2}\d{8}$/;

// Didit баримтаас латин галиглалаар уншдаг тул үсгийг кирилл болгоно. Хоёр үсэгтэйг
// эхэлж шалгана. О/Ө, У/Ү, Е/Э зэрэг ялгаагүй үсгийг хэрэглэгч засах боломжтой.
const LATIN_TO_CYRILLIC = [
  ["KH", "Х"], ["TS", "Ц"], ["CH", "Ч"], ["SH", "Ш"], ["YU", "Ю"], ["YA", "Я"], ["YO", "Ё"],
  ["A", "А"], ["B", "Б"], ["V", "В"], ["G", "Г"], ["D", "Д"], ["E", "Е"], ["J", "Ж"], ["Z", "З"],
  ["I", "И"], ["K", "К"], ["L", "Л"], ["M", "М"], ["N", "Н"], ["O", "О"], ["Ö", "Ө"], ["P", "П"],
  ["R", "Р"], ["S", "С"], ["T", "Т"], ["U", "У"], ["Ü", "Ү"], ["F", "Ф"], ["H", "Х"], ["C", "Ц"],
  ["Y", "Ы"], ["W", "В"],
];

function toCyrillic(letters) {
  let result = "";
  for (let i = 0; i < letters.length; ) {
    const [latin, cyrillic] = LATIN_TO_CYRILLIC.find(([key]) => letters.startsWith(key, i)) ?? [letters[i], letters[i]];
    result += cyrillic;
    i += latin.length;
  }
  return result;
}

// Зай, тэмдэгтийг хасаж том үсэг болгоно. Латин үсэгтэй бол кирилл рүү хөрвүүлнэ.
export function normalizeRegnum(value) {
  const text = String(value ?? "").toUpperCase().replace(/[\s-]/g, "");
  const match = text.match(/^([A-ZÖÜ]{2,4})(\d{8})$/);
  return match ? toCyrillic(match[1]) + match[2] : text;
}

export const isValidRegnum = (value) => REGNUM_PATTERN.test(value);
