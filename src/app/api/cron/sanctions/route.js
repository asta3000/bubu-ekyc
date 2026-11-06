import { importSanctions } from "@/lib/sanctions/importer";
import { importMessage } from "@/lib/sanctions/messages";
import { failingSources, sendFailingAlert, sendImportReport } from "@/lib/sanctions/notify";
import { SANCTION_SOURCE_KEYS } from "@/lib/sanctions/sources";

export const maxDuration = 300;

// Тайлан илгээх хугацаа үлдээхийн тулд үүнээс удаан импортыг хүлээхгүй (импорт өөрөө
// үргэлжилж болно, тасарвал дараагийн удаа FAILED болно)
const IMPORT_DEADLINE_MS = 280_000;

const withDeadline = (promise, deadline) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Хугацаандаа дуусаагүй")), deadline - Date.now())),
  ]);

// Vercel Cron (vercel.json) өдөр бүр дуудна. Vercel нь CRON_SECRET-ийг
// "Authorization: Bearer <CRON_SECRET>" header-ээр илгээдэг.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Хандах эрхгүй" }, { status: 401 });
  }

  // Зэрэг импортлоно: зарим эх сурвалж (Франц ~2.5 минут) удаан тул дараалуулбал
  // maxDuration-д багтахгүй. Нэг нь амжилтгүй болсон ч бусад нь үргэлжилнэ.
  const deadline = Date.now() + IMPORT_DEADLINE_MS;
  const settled = await Promise.allSettled(
    SANCTION_SOURCE_KEYS.map((source) => withDeadline(importSanctions(source), deadline)),
  );
  const report = settled.map((result, index) => ({
    source: SANCTION_SOURCE_KEYS[index],
    ok: result.status === "fulfilled",
    message: result.status === "fulfilled" ? importMessage(result.value) : `Алдаа: ${result.reason?.message}`,
  }));

  // Бүх жагсаалт дууссаны дараа админуудад тайлан, нэг сар амжилтгүй жагсаалтын анхааруулга
  const mail = {};
  try {
    mail.report = await sendImportReport(report);
    const failing = await failingSources();
    mail.failing = failing.map((item) => item.source);
    mail.alert = await sendFailingAlert(failing);
  } catch (error) {
    console.error("[cron/sanctions] mail:", error.message);
    mail.error = error.message;
  }

  return Response.json({ results: Object.fromEntries(report.map((item) => [item.source, item.message])), mail });
}
