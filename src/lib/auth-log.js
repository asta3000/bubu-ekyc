import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit/log";
import { requestInfo } from "@/lib/request-info";

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
  await logAudit({
    action: `auth.${event.toLowerCase()}`,
    actor: userId ? { id: userId } : { email },
    status: event.endsWith("_FAILED") ? "FAILURE" : "SUCCESS",
    metadata: { provider, reason },
  });
}
