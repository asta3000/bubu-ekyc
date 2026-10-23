// Огноо, нэрийг харуулах нийтлэг функцууд. Сервер, client хоёуланд ижил үр дүн
// гаргахын тулд цагийн бүсийг тогтмол (Улаанбаатар) өгнө.

const TIME_ZONE = "Asia/Ulaanbaatar";

const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, dateStyle: "short" });
const dateTimeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Улаанбаатарын цагаар одоогийн (эсвэл өгсөн огнооны) он
const yearFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric" });
export const ulaanbaatarYear = (date = new Date()) => Number(yearFormat.format(new Date(date)));

// 2026-10-22
export const formatDate = (date) => (date ? dateFormat.format(new Date(date)) : "—");

// 2026-10-22, 14:05
export const formatDateTime = (date) => (date ? dateTimeFormat.format(new Date(date)) : "—");

// "Овог Нэр". Хэрэглэгч байхгүй бол fallback.
export const personName = (user, fallback = "—") => (user ? `${user.lastName} ${user.firstName}` : fallback);

// 12,000₮
export const formatMoney = (amount) => `${Number(amount ?? 0).toLocaleString("en-US")}₮`;
