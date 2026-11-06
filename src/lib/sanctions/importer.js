import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseAustralia } from "./parsers/australia";
import { parseCanada } from "./parsers/canada";
import { parseCsl } from "./parsers/csl";
import { parseEu } from "./parsers/eu";
import { parseEu833 } from "./parsers/eu-833";
import { parseFrance } from "./parsers/france";
import { parseJapan } from "./parsers/japan";
import { parseOfac } from "./parsers/ofac";
import { parseSeco } from "./parsers/seco";
import { parseUk } from "./parsers/uk";
import { parseUn } from "./parsers/un";
import { parseWorldBank } from "./parsers/worldbank";
import { sanctionSource } from "./sources";
import { download } from "./utils";

const PARSERS = {
  UN: parseUn,
  EU: parseEu,
  OFAC_SDN: parseOfac,
  OFAC_NON_SDN: parseOfac,
  UK: parseUk,
  US_CSL: parseCsl,
  EU_833_XLV: parseEu833,
  WORLD_BANK: parseWorldBank,
  CA_SEMA: parseCanada,
  FR_GELS: parseFrance,
  CH_SECO: parseSeco,
  JP_MOF: parseJapan,
  AU_DFAT: parseAustralia,
};

// Эх сурвалжийн татах тохиргоо. Дэлхийн банкны API нь тэдний вэб хуудсанд нээлттэй
// байгаа apikey шаарддаг (солигдвол WORLD_BANK_API_KEY-ээр өгнө). Францын сервер удаан
// (15MB ~2.5 минут), SECO-ийн файл том (~45MB) тул хугацааг уртасгана.
const DOWNLOAD_OPTIONS = {
  WORLD_BANK: { headers: { apikey: process.env.WORLD_BANK_API_KEY || "z9duUaFUiEUYSHs97CU38fcZO7ipOPvm" } },
  FR_GELS: { timeout: 270_000 },
  CH_SECO: { timeout: 240_000 },
  AU_DFAT: { binary: true },
};

// Тогтмол URL-гүй эх сурвалж: хуудаснаас хамгийн сүүлийн файлын линкийг олно.
// Японы MOF файлын нэрэнд огноо оруулдаг (shisantouketsu20261105.csv).
const RESOLVE_URL = {
  JP_MOF: async (pageUrl) => {
    const links = [...(await download(pageUrl)).matchAll(/href="([^"]*shisantouketsu(\d{8})\.csv)"/g)];
    const latest = links.sort((a, b) => b[2].localeCompare(a[2]))[0];
    if (!latest) throw new Error("Японы жагсаалтын CSV линк хуудаснаас олдсонгүй. Хуудасны бүтэц өөрчлөгдсөн байж магадгүй.");
    return new URL(latest[1], pageUrl).href;
  },
};

const sourceUrl = (source) => RESOLVE_URL[source.key]?.(source.url) ?? source.url;

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
    // url-гүй эх сурвалж (EU_833_XLV) өгөгдлөө кодоос уншина
    const parsed = await PARSERS[source.key](
      source.url ? await download(await sourceUrl(source), DOWNLOAD_OPTIONS[source.key]) : null,
    );
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
