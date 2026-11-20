// Багцаар тооцоологдох үйлчилгээнүүд. Шинэ үйлчилгээ нэмэхдээ энд бүртгээд,
// тухайн үйлчилгээний API-д consumeService(..., "<key>") дуудна. Client-д ч ашиглана.
export const BILLABLE_SERVICES = [
  {
    key: "SANCTION_SCREENING",
    name: "Хориг шалгах",
    unit: "шалгалт",
    href: "/organizations/match",
  },
  {
    key: "DOCUMENT_VERIFICATION",
    name: "Баримт бичиг баталгаажуулах",
    unit: "баталгаажуулалт",
    href: "/organizations/verifications",
  },
];

export const SERVICE_KEYS = BILLABLE_SERVICES.map((service) => service.key);

export const billableService = (key) => BILLABLE_SERVICES.find((service) => service.key === key);

export const serviceName = (key) => billableService(key)?.name ?? key;

// Үйлчилгээнд багцын тоо хэрэглэгдэх эсэх: суурь үнэтэй багц, эсвэл тоо оруулсан үйлчилгээ.
// Суурь үнэ 0, тоо 0 бол бүх ашиглалт шууд задгай үнээр хэтэвчнээс.
export const includesQuota = (basePrice, quota) => basePrice > 0 || quota > 0;

// Багц гэрээ шаардах эсэх. Зөвхөн false гэж тодорхой тохируулсан багц гэрээгүй байгууллагад;
// утга ирээгүй (select-д ороогүй г.м.) бол аюулгүй талаас нь гэрээ шаардана гэж үзнэ.
export const requiresContract = (pkg) => pkg.contractRequired !== false;

// Багцыг жилээр авах нөхцөл. annual: { discountRate, durationDays } (админы тохиргоо).
// Жилийн хоногт багцын хугацаа хэдэн удаа ("сар") багтахыг бүхэлчилж (365/30 → 12) үнийг
// үржүүлээд хөнгөлөлт хасна. Үйлчилгээний тоо сар бүрийнх хэвээр (сар солигдоход шинэчлэгдэнэ).
// Хугацаагүй эсвэл үнэгүй багцад жилийн нөхцөл байхгүй (null).
// Буцаах: { periods, periodDays, fullPrice, price, saving, discountRate, durationDays }
export function annualTerms(pkg, annual) {
  if (!annual || !pkg.durationDays || pkg.basePrice === 0) return null;
  const periods = Math.max(1, Math.round(annual.durationDays / pkg.durationDays));
  const fullPrice = pkg.basePrice * periods;
  const price = Math.round((fullPrice * (100 - annual.discountRate)) / 100);
  return {
    periods,
    periodDays: pkg.durationDays,
    fullPrice,
    price,
    saving: fullPrice - price,
    discountRate: annual.discountRate,
    durationDays: annual.durationDays,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Жилийн багцын одоогийн "сар". subscription: { startsAt, expiresAt, durationDays, periodDays }.
// Сүүлийн сар жилийн дуусах өдөр хүртэл үргэлжилнэ (365 = 11×30 + 35).
// Буцаах: { total, index, start, end, remaining, isLast } (index 0-ээс, remaining: одоогийнхоос
// хойших сарын тоо) эсвэл жилийн багц биш бол null
export function annualPeriod(subscription, now = new Date()) {
  if (!subscription?.annual || !subscription.startsAt || !subscription.expiresAt || !subscription.periodDays) return null;
  const startsAt = new Date(subscription.startsAt).getTime();
  const expiresAt = new Date(subscription.expiresAt).getTime();
  const length = subscription.periodDays * DAY_MS;
  const total = Math.max(1, Math.round(subscription.durationDays / subscription.periodDays));
  const index = Math.min(total - 1, Math.max(0, Math.floor((new Date(now).getTime() - startsAt) / length)));
  const isLast = index === total - 1;
  return {
    total,
    index,
    start: new Date(startsAt + index * length),
    end: new Date(isLast ? expiresAt : startsAt + (index + 1) * length),
    remaining: total - 1 - index,
    isLast,
  };
}

// Жилийн багцыг ахиулах үнийн зөрүү: (шинэ жилийн үнэ − одоогийн жилийн үнэ) × одоогийн сараас
// хойших сарын тоо ÷ нийт сар. Одоогийн сар дуусахад хэрэгжинэ. Сүүлийн сард ахиулахгүй (null).
// Буцаах: { amount, effectiveAt, months } эсвэл null
export function upgradeQuote(subscription, targetAnnualPrice, now = new Date()) {
  const period = annualPeriod(subscription, now);
  if (!period || period.isLast || targetAnnualPrice <= subscription.basePrice) return null;
  return {
    amount: Math.round(((targetAnnualPrice - subscription.basePrice) * period.remaining) / period.total),
    effectiveAt: period.end,
    months: period.remaining,
  };
}

// Жилийн багцын сүүлийн сард, автомат сунгалт асаалттай үед ахиулах захиалга: ахисан багцын
// жилийн үнийг бүтнээр барьж, жилийн хугацаа дуусахад (сунгалтаар) хэрэгжинэ.
// Сүүлийн сар биш, автомат сунгалт зогссон, эсвэл илүү үнэтэй биш бол null.
// Буцаах: { amount, effectiveAt, months, renewal: true } эсвэл null
export function renewalUpgradeQuote(subscription, targetAnnualPrice, now = new Date()) {
  const period = annualPeriod(subscription, now);
  if (!period?.isLast || !subscription.autoRenew || targetAnnualPrice <= subscription.basePrice) return null;
  return { amount: targetAnnualPrice, effectiveAt: period.end, months: period.total, renewal: true };
}
