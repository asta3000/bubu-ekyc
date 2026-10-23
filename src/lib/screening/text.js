import { DEFAULT_MATCHING } from "./config";

// Нэр харьцуулах: кирилл → латин, том жижиг үсэг, тэмдэгт, хуулийн хэлбэр хасах,
// Jaro-Winkler төстэй байдал. config: онооны тохиргоо (./config.js, админ өөрчилнө).

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "i",
  к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "i",
  э: "e", ю: "yu", я: "ya",
};

// Кирилл үсгийг латин болгоно. х-г "kh" болон "h" хоёр хувилбараар гаргана.
export function transliterations(text) {
  const lower = text.toLowerCase();
  if (!/[а-яёөү]/.test(lower)) return [lower];
  const convert = (kh) =>
    [...lower].map((char) => (char === "х" ? kh : CYRILLIC[char] ?? char)).join("");
  return [...new Set([convert("kh"), convert("h")])];
}

// Үсэг, тооноос бусдыг хасаж, диакритикийг арилгана (Müller → muller)
export const normalize = (text) =>
  String(text ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// stopWords: Set (хуулийн хэлбэр г.м. утгагүй үгс)
export const tokenize = (text, stopWords) => normalize(text).split(" ").filter((t) => t && !stopWords.has(t));

const defaultStopWords = new Set(DEFAULT_MATCHING.stopWords);

// Харьцуулахад бэлэн нэр: үгс болон зайгүй нийлүүлсэн хэлбэр (үгсийн дараалал хамаарахгүй)
export function prepareName(text, stopWords = defaultStopWords) {
  const tokens = tokenize(text, stopWords);
  return { text, tokens, joined: [...tokens].sort().join("") };
}

// Jaro-Winkler төстэй байдал 0..1
export function jaroWinkler(a, b) {
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  if (!lenA || !lenB) return 0;

  const range = Math.max(0, Math.floor(Math.max(lenA, lenB) / 2) - 1);
  const matchedA = new Array(lenA).fill(false);
  const matchedB = new Array(lenB).fill(false);
  let matches = 0;
  for (let i = 0; i < lenA; i++) {
    const end = Math.min(i + range + 1, lenB);
    for (let j = Math.max(0, i - range); j < end; j++) {
      if (matchedB[j] || a[i] !== b[j]) continue;
      matchedA[i] = matchedB[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let transpositions = 0;
  for (let i = 0, j = 0; i < lenA; i++) {
    if (!matchedA[i]) continue;
    while (!matchedB[j]) j++;
    if (a[i] !== b[j]) transpositions++;
    j++;
  }
  const jaro = (matches / lenA + matches / lenB + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

// Хоёр үгийн төстэй байдал. Хол зөрүүтэй үгийг ("hamenei" ба "hamed") бараг
// тохироогүйд тооцож, нэг үг таарснаар бүх нэр таарсан мэт харагдахаас сэргийлнэ.
function tokenSimilarity(a, b, config) {
  const score = jaroWinkler(a, b);
  return score >= config.tokenMatch ? score : score * config.tokenPenalty;
}

// Нэг үг бүрт нөгөө нэрийн хамгийн төстэй үгийг олж дунджийг авна
const coverage = (from, to, config) =>
  from.reduce((sum, token) => sum + Math.max(...to.map((other) => tokenSimilarity(token, other, config))), 0) /
  from.length;

// Нийлүүлсэн хэлбэр нь үг нийлсэн/салсан ("Abdulrahman" = "Abdul Rahman") тохиолдолд
// зориулагдсан тул үгийн тоо зөрүүтэй, урт нь ойролцоо үед л харьцуулна
function joinedComparison(query, candidate, config) {
  const lengthRatio =
    Math.min(query.joined.length, candidate.joined.length) / Math.max(query.joined.length, candidate.joined.length);
  const applies = query.tokens.length !== candidate.tokens.length && lengthRatio >= config.joinedMinRatio;
  return { applies, lengthRatio, score: applies ? jaroWinkler(query.joined, candidate.joined) * config.joinedWeight : 0 };
}

// Хоёр нэрийн төстэй байдал 0..100. Үгсийн дараалал ("ABBAS, Abu" = "Abu Abbas"),
// үсгийн алдаа, үг нийлсэн/салсан ("Abdulrahman" = "Abdul Rahman")-ыг тооцно.
// Хайсан нэрний бүх үг тохирох нь чухал (queryWeight), нэр дээрх илүү үг бага нөлөөлнө.
// Олон мянган нэрийг тулгадаг тул задаргаагүй хурдан хувилбар.
export function nameScore(query, candidate, config = DEFAULT_MATCHING) {
  if (!query.tokens.length || !candidate.tokens.length) return 0;
  if (query.joined === candidate.joined) return 100;
  const byTokens =
    coverage(query.tokens, candidate.tokens, config) * config.queryWeight +
    coverage(candidate.tokens, query.tokens, config) * (1 - config.queryWeight);
  return Math.round(Math.max(byTokens, joinedComparison(query, candidate, config).score) * 100);
}

// Үг бүрийн хамгийн төстэй хос: [{ token, best, similarity, score }]
const tokenPairs = (from, to, config) =>
  from.map((token) => {
    let pair = { token, best: null, similarity: 0, score: 0 };
    for (const other of to) {
      const score = tokenSimilarity(token, other, config);
      if (score > pair.score) pair = { token, best: other, similarity: jaroWinkler(token, other), score };
    }
    return pair;
  });

const averageScore = (pairs) => pairs.reduce((sum, pair) => sum + pair.score, 0) / pairs.length;

// nameScore-тэй ижил тооцоог задаргаатай нь буцаана (админы "турших" хэрэгсэлд)
export function explainNameScore(query, candidate, config = DEFAULT_MATCHING) {
  if (!query.tokens.length || !candidate.tokens.length) return { score: 0, method: "empty" };
  if (query.joined === candidate.joined) return { score: 100, method: "exact" };
  const forward = tokenPairs(query.tokens, candidate.tokens, config);
  const backward = tokenPairs(candidate.tokens, query.tokens, config);
  const byTokens = averageScore(forward) * config.queryWeight + averageScore(backward) * (1 - config.queryWeight);
  const joined = joinedComparison(query, candidate, config);
  return {
    score: Math.round(Math.max(byTokens, joined.score) * 100),
    method: joined.score > byTokens ? "joined" : "tokens",
    forward,
    backward,
    byTokens,
    joined,
  };
}
