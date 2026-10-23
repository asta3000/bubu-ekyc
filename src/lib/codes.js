import { randomInt } from "node:crypto";

// Андуурагдах тэмдэгтгүй (0/O, 1/I/L) цагаан толгой
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_ATTEMPTS = 5;

export const randomCode = (length = 8) =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

// Давхардаагүй код (промо, купон г.м.). isTaken(code) нь DB-д байгаа эсэхийг шалгана.
// 31^8 хувилбартай тул давхцал бараг гарахгүй ч шалгана.
export async function uniqueCode(isTaken, length) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode(length);
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Давхардаагүй код үүсгэж чадсангүй");
}
