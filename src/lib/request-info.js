import { headers } from "next/headers";

// Хүсэлтийн IP ба user agent. Vercel/proxy-ийн ард x-forwarded-for-ийн эхний утга нь хэрэглэгчийнх.
export async function requestInfo() {
  try {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
      ip: forwarded || list.get("x-real-ip") || null,
      userAgent: list.get("user-agent")?.slice(0, 500) ?? null,
    };
  } catch {
    // Хүсэлтийн context-оос гадуур (script, cron г.м.) дуудагдсан
    return { ip: null, userAgent: null };
  }
}
