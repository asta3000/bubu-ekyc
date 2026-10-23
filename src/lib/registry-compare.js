import { formatDate } from "@/lib/format";
import { normalizeRegnum } from "@/lib/regnum";
import { nameScore, prepareName, transliterations } from "@/lib/screening/text";

// ХУР кирилл, Didit латин галиглал буцаадаг тул кирилл нэрийг латин болгож харьцуулна
const NAME_MATCH = 85;

function sameName(registry, document) {
  if (!registry || !document) return null;
  const score = Math.max(
    ...transliterations(registry).map((latin) => nameScore(prepareName(latin), prepareName(document))),
  );
  return score >= NAME_MATCH;
}

function gender(value) {
  const text = String(value ?? "").toLowerCase();
  if (/^m$|эр/.test(text)) return "M";
  if (/^f$|эм/.test(text)) return "F";
  return null;
}

const same = (a, b) => (a && b ? a === b : null);

// Баримтаас (Didit) уншсан ба ХУР-ын мэдээллийг талбар бүрээр тулгана.
// match: true таарсан, false зөрсөн, null харьцуулах мэдээлэлгүй
// ХУР-ын төрсөн огноо (цагийн бүстэй) → Улаанбаатарын цагаар yyyy-mm-dd
export const registryBirthDate = (card) => (card.birthDate ? formatDate(card.birthDate) : null);

export function compareWithRegistry(verification, card) {
  const birthDate = registryBirthDate(card);
  return [
    { label: "Регистр", document: verification.personalNumber, registry: card.regnum, match: same(normalizeRegnum(verification.personalNumber), card.regnum) },
    { label: "Овог", document: verification.lastName, registry: card.lastname, match: sameName(card.lastname, verification.lastName) },
    { label: "Нэр", document: verification.firstName, registry: card.firstname, match: sameName(card.firstname, verification.firstName) },
    { label: "Төрсөн огноо", document: verification.dateOfBirth, registry: birthDate ?? card.birthDateAsText, match: same(verification.dateOfBirth, birthDate) },
    { label: "Хүйс", document: verification.gender, registry: card.gender, match: same(gender(verification.gender), gender(card.gender)) },
  ];
}
