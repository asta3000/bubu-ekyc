import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

// Системд харуулах баримтууд. Агуулгыг админ /managements/content-оос засаж өгөгдлийн санд
// (ContentDocument) хадгална. Хэзээ ч засаагүй бол src/content/<file>-ийн анхны агуулгыг
// харуулна (Vercel-д серверт хүрэхийн тулд next.config.mjs-ийн outputFileTracingIncludes-д бүртгэсэн).
//   versioned: хэрэглэгчийн зөвшөөрөлд хамаарах (хувилбар өөрчлөгдвөл дахин зөвшөөрүүлнэ)
export const DOCUMENTS = {
  terms: { file: "terms.md", title: "Үйлчилгээний нөхцөл", path: "/terms", versioned: true },
  privacy: { file: "privacy.md", title: "Нууцлал ба аюулгүй байдал", path: "/privacy", versioned: true },
  guide: { file: "guide.md", title: "Гарын авлага", path: "/guide", versioned: false },
};

export const DOCUMENT_KEYS = Object.keys(DOCUMENTS);

// Файлын анхны агуулга: эхний "<!-- version: ... -->" мөрөөс хувилбар, бусад сэтгэгдлийг хасна
async function readDefault(key) {
  const raw = await readFile(path.join(process.cwd(), "src/content", DOCUMENTS[key].file), "utf8");
  const version = raw.match(/<!--\s*version:\s*([^\s]+)\s*-->/)?.[1] ?? null;
  return { markdown: raw.replace(/<!--[\s\S]*?-->\s*/g, ""), version };
}

// Буцаах: { markdown, version, updatedAt } (updatedAt: засаагүй бол null)
export async function readDocument(key) {
  const row = await prisma.contentDocument.findUnique({
    where: { key },
    select: { markdown: true, version: true, updatedAt: true },
  });
  if (row) return row;
  return { ...(await readDefault(key)), updatedAt: null };
}

// Шинэ хувилбарын тэмдэг: хадгалсан огноо, цаг (Улаанбаатарын цагаар), жишээ нь 2026-11-21.1430
export const newVersion = (now = new Date()) =>
  new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16).replace("T", ".").replace(":", "");
