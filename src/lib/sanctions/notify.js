import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/format";
import { renderMessage, sendMail } from "@/lib/mail";
import { SANCTION_SOURCES } from "./sources";

// Энэ хугацаанд нэг ч амжилттай (SUCCESS, NO_CHANGE) импорт хийгдээгүй жагсаалтыг
// "бүтэн амжилтгүй" гэж үзэж админд тусад нь анхааруулна
export const FAILING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const OK_STATUSES = ["SUCCESS", "NO_CHANGE"];

const appUrl = () => (process.env.AUTH_URL ?? "").replace(/\/$/, "");
const sanctionsPage = () => (appUrl() ? { label: "Хоригийн жагсаалт руу орох", url: `${appUrl()}/managements/sanctions` } : null);

// Идэвхтэй системийн админуудын имэйл
async function adminEmails() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { email: true },
  });
  return admins.map((admin) => admin.email);
}

// Админ бүрт тусад нь илгээнэ (бие биенийхээ хаягийг харахгүй). Буцаах: илгээсэн тоо
async function sendToAdmins(subject, message) {
  const emails = await adminEmails();
  const results = await Promise.allSettled(emails.map((to) => sendMail({ to, subject, ...renderMessage(message) })));
  return results.filter((result) => result.status === "fulfilled").length;
}

// Автомат импортын тайлан. results: [{ source, ok, message }]
export async function sendImportReport(results) {
  const failed = results.filter((result) => !result.ok);
  const succeeded = results.filter((result) => result.ok);
  const line = ({ source, message }) =>
    `• ${SANCTION_SOURCES.find((item) => item.key === source)?.name ?? source}: ${message}`;

  const subject = failed.length
    ? `Хоригийн жагсаалтын импорт: ${failed.length} амжилтгүй, ${succeeded.length} амжилттай`
    : `Хоригийн жагсаалтын импорт: бүгд амжилттай (${succeeded.length})`;
  return sendToAdmins(subject, {
    heading: `Хоригийн жагсаалтын автомат импорт (${formatDateTime(new Date())})`,
    lines: [
      ...(failed.length ? ["Амжилтгүй:", ...failed.map(line), ""] : []),
      "Амжилттай:",
      ...(succeeded.length ? succeeded.map(line) : ["• Байхгүй"]),
    ],
    action: sanctionsPage(),
  });
}

// Сүүлийн FAILING_DAYS хоногт оролдлого хийгдсэн ч нэг ч удаа амжилттай болоогүй жагсаалтууд.
// Шинээр нэмэгдсэн (анхны оролдлого нь FAILING_DAYS-ээс шинэ) жагсаалтыг тооцохгүй.
// Буцаах: [{ source, name, lastOkAt, lastError }]
export async function failingSources(now = new Date()) {
  const since = new Date(now.getTime() - FAILING_DAYS * DAY_MS);
  const failing = await Promise.all(
    SANCTION_SOURCES.map(async (source) => {
      const [lastOk, first, lastFailed] = await Promise.all([
        prisma.sanctionImport.findFirst({
          where: { source: source.key, status: { in: OK_STATUSES } },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        }),
        prisma.sanctionImport.findFirst({
          where: { source: source.key },
          orderBy: { startedAt: "asc" },
          select: { startedAt: true },
        }),
        prisma.sanctionImport.findFirst({
          where: { source: source.key, status: "FAILED", startedAt: { gte: since } },
          orderBy: { startedAt: "desc" },
          select: { error: true },
        }),
      ]);
      const failingSince = lastOk?.startedAt ?? first?.startedAt;
      if (!lastFailed || !failingSince || failingSince > since) return null;
      return { source: source.key, name: source.name, lastOkAt: lastOk?.startedAt ?? null, lastError: lastFailed.error };
    }),
  );
  return failing.filter(Boolean);
}

// Удаан хугацаанд шинэчлэгдээгүй жагсаалтын тусгай анхааруулга. Нөхцөл арилтал шөнө бүр илгээнэ.
export async function sendFailingAlert(failing) {
  if (!failing.length) return 0;
  return sendToAdmins(`АНХААР: ${failing.length} хоригийн жагсаалт ${FAILING_DAYS}+ хоног шинэчлэгдээгүй`, {
    heading: `${FAILING_DAYS}+ хоног амжилттай импортлогдоогүй жагсаалт`,
    lines: [
      "Доорх жагсаалтуудын автомат импорт сүүлийн нэг сарын турш бүгд амжилтгүй болсон. Тулгалт хуучин өгөгдлөөр хийгдэж байна. Эх сурвалжийн хаяг, файлын бүтэц өөрчлөгдсөн эсэхийг шалгана уу.",
      "",
      ...failing.flatMap(({ name, lastOkAt, lastError }) => [
        `• ${name}: сүүлд амжилттай ${lastOkAt ? formatDate(lastOkAt) : "хэзээ ч импортлогдоогүй"}`,
        `  Сүүлийн алдаа: ${lastError ?? "—"}`,
      ]),
    ],
    action: sanctionsPage(),
  });
}
