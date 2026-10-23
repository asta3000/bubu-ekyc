// Импортын үр дүнгийн мессеж (API болон cron-д)
export function importMessage(result) {
  if (result.status === "NO_CHANGE") return "Шинэчлэлт байхгүй";
  return `Импорт амжилттай: ${result.total} бичлэг (+${result.added} нэмэгдсэн, ${result.updated} өөрчлөгдсөн, −${result.removed} хасагдсан)`;
}
