import { importSanctions } from "@/lib/sanctions/importer";
import { importMessage } from "@/lib/sanctions/messages";
import { SANCTION_SOURCE_KEYS } from "@/lib/sanctions/sources";

export const maxDuration = 300;

// Vercel Cron (vercel.json) өдөр бүр дуудна. Vercel нь CRON_SECRET-ийг
// "Authorization: Bearer <CRON_SECRET>" header-ээр илгээдэг.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Хандах эрхгүй" }, { status: 401 });
  }

  // Нэг нь амжилтгүй болсон ч бусдыг үргэлжлүүлнэ. Үр дүн нь түүхэнд бүртгэгдэнэ.
  const results = {};
  for (const source of SANCTION_SOURCE_KEYS) {
    try {
      results[source] = importMessage(await importSanctions(source));
    } catch (error) {
      results[source] = `Алдаа: ${error.message}`;
    }
  }
  return Response.json({ results });
}
