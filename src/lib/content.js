import { readFile } from "node:fs/promises";
import path from "node:path";

// Системд харуулах баримтууд (src/content/*.md). Файлыг засаад deploy хийхэд шууд шинэчлэгдэнэ.
// Vercel дээр файлууд серверт хүрэхийн тулд next.config.mjs-ийн outputFileTracingIncludes-д бүртгэсэн.
const DOCUMENTS = { terms: "terms.md", privacy: "privacy.md", guide: "guide.md" };

// Буцаах: { markdown, version } — version нь файлын эхний "<!-- version: ... -->" мөрөөс.
// Файл зөвхөн deploy-оор өөрчлөгдөх тул кэшлэнэ (хуудсууд prerender хийгдэнэ).
export async function readDocument(key) {
  "use cache";
  const raw = await readFile(path.join(process.cwd(), "src/content", DOCUMENTS[key]), "utf8");
  const version = raw.match(/<!--\s*version:\s*([^\s]+)\s*-->/)?.[1] ?? null;
  return { markdown: raw.replace(/<!--[\s\S]*?-->\s*/g, ""), version };
}
