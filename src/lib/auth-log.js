import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Хүсэлтийн IP ба user agent. Vercel/proxy-ийн ард x-forwarded-for-ийн эхний утга нь хэрэглэгчийнх.
async function requestInfo() {
  try {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
      ip: forwarded || list.get("x-real-ip") || null,
      userAgent: list.get("user-agent")?.slice(0, 500) ?? null,
    };
  } catch {
    // Хүсэлтийн context-оос гадуур (script г.м.) дуудагдсан
    return { ip: null, userAgent: null };
  }
}

// Нэвтрэлтийн үйлдлийг AuthLog-д бүртгэнэ. Лог бичих алдаа нь нэвтрэлт,
// бүртгэлийг таслахгүй тул алдааг зөвхөн console-д хэвлэнэ.
// event: AUTH_EVENT (REGISTER, LOGIN, LOGIN_FAILED, LOGOUT, ...)
export async function logAuthEvent({ event, email, userId = null, provider = null, reason = null }) {
  try {
    await prisma.authLog.create({
      data: {
        event,
        email: String(email ?? "").toLowerCase(),
        userId,
        provider,
        reason,
        ...(await requestInfo()),
      },
    });
  } catch (error) {
    console.error(`[auth-log] ${event} ${email}:`, error.message);
  }
}
