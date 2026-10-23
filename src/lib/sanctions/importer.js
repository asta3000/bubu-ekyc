import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseCsl } from "./parsers/csl";
import { parseEu } from "./parsers/eu";
import { parseOfac } from "./parsers/ofac";
import { parseUk } from "./parsers/uk";
import { parseUn } from "./parsers/un";
import { sanctionSource } from "./sources";
import { download } from "./utils";

const PARSERS = {
  UN: parseUn,
  EU: parseEu,
  OFAC_SDN: parseOfac,
  OFAC_NON_SDN: parseOfac,
  UK: parseUk,
  US_CSL: parseCsl,
};

// Үүнээс удаан RUNNING байгаа импортыг тасарсан гэж үзнэ
const STALE_AFTER_MS = 15 * 60 * 1000;
const CHUNK_SIZE = 1000;

const sha256 = (value) => createHash("sha256").update(value).digest("base64url");

const chunks = (items, size = CHUNK_SIZE) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// Нэр, дугааргүй бичлэгийг хасаж, давхардсан дугаартай бол эхнийхийг үлдээнэ.
// Бичлэг бүрт hash, бүх жагсаалтад нийт hash тооцно.
function prepare(records, source) {
  const byId = new Map();
  for (const record of records) {
    if (!record.externalId || !record.name || byId.has(record.externalId)) continue;
    byId.set(record.externalId, { ...record, source, hash: sha256(JSON.stringify(record)) });
  }
  const prepared = [...byId.values()].sort((a, b) => a.externalId.localeCompare(b.externalId));
  const contentHash = sha256(prepared.map((r) => `${r.externalId}:${r.hash}`).join("\n"));
  return { records: prepared, contentHash };
}

export class ImportInProgressError extends Error {}

// Нэг эх сурвалжийг импортлоно. Сүүлийн амжилттай импортоос хойш өөрчлөгдөөгүй бол
// өгөгдөлд хүрэхгүй, NO_CHANGE гэж түүхэнд бүртгэнэ. userId хоосон бол автомат (cron).
export async function importSanctions(sourceKey, userId = null) {
  const source = sanctionSource(sourceKey);
  if (!source) throw new Error(`Тодорхойгүй эх сурвалж: ${sourceKey}`);

  // Тасарсан (function-ий хугацаа хэтэрсэн г.м.) импортыг FAILED болгоно
  await prisma.sanctionImport.updateMany({
    where: { source: source.key, status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
    data: { status: "FAILED", error: "Импорт дуусаагүй тасарсан", finishedAt: new Date() },
  });
  const running = await prisma.sanctionImport.findFirst({
    where: { source: source.key, status: "RUNNING" },
    select: { id: true },
  });
  if (running) throw new ImportInProgressError(`${source.name}-ийн импорт явагдаж байна`);

  const history = await prisma.sanctionImport.create({
    data: { source: source.key, userId },
    select: { id: true },
  });
  const finish = (data) =>
    prisma.sanctionImport.update({
      where: { id: history.id },
      data: { ...data, finishedAt: new Date() },
    });

  try {
    const parsed = PARSERS[source.key](await download(source.url));
    const { records, contentHash } = prepare(parsed.records, source.key);
    if (records.length === 0) throw new Error("Жагсаалтаас бичлэг олдсонгүй. Файлын бүтэц өөрчлөгдсөн байж магадгүй.");

    const lastSuccess = await prisma.sanctionImport.findFirst({
      where: { source: source.key, status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      select: { contentHash: true },
    });
    const summary = { contentHash, publishedAt: parsed.publishedAt, total: records.length };
    if (lastSuccess?.contentHash === contentHash) {
      return await finish({ ...summary, status: "NO_CHANGE" });
    }

    // Одоо байгаа бичлэгтэй харьцуулж нэмэгдсэн, өөрчлөгдсөн, хасагдсаныг олно
    const existing = new Map(
      (
        await prisma.sanctionEntry.findMany({
          where: { source: source.key },
          select: { externalId: true, hash: true },
        })
      ).map((entry) => [entry.externalId, entry.hash]),
    );
    const added = records.filter((r) => !existing.has(r.externalId));
    const changed = records.filter((r) => existing.has(r.externalId) && existing.get(r.externalId) !== r.hash);
    const current = new Set(records.map((r) => r.externalId));
    const removedIds = [...existing.keys()].filter((id) => !current.has(id));

    // Өөрчлөгдсөнийг устгаад дахин үүсгэнэ (олон update-ээс хурдан)
    await prisma.$transaction(
      async (tx) => {
        for (const ids of chunks([...removedIds, ...changed.map((r) => r.externalId)], 5000)) {
          await tx.sanctionEntry.deleteMany({ where: { source: source.key, externalId: { in: ids } } });
        }
        for (const data of chunks([...added, ...changed])) {
          await tx.sanctionEntry.createMany({ data });
        }
      },
      { maxWait: 10_000, timeout: 240_000 },
    );

    return await finish({
      ...summary,
      status: "SUCCESS",
      added: added.length,
      updated: changed.length,
      removed: removedIds.length,
    });
  } catch (error) {
    await finish({ status: "FAILED", error: String(error.message ?? error).slice(0, 1000) });
    throw error;
  }
}
