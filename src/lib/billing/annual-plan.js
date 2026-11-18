import { prisma } from "@/lib/prisma";
import { annualTerms } from "./services";

// Багцыг жилээр худалдан авах үеийн тохиргоо (админ "Тохиргоо → Параметр утгууд"-аас)
export const DEFAULT_ANNUAL_DISCOUNT_RATE = 0;
export const DEFAULT_ANNUAL_DURATION_DAYS = 365;

// Буцаах: { discountRate, durationDays }
export async function annualPlanSettings(db = prisma) {
  const settings = await db.systemSetting.findUnique({
    where: { id: "system" },
    select: { annualDiscountRate: true, annualDurationDays: true },
  });
  return {
    discountRate: settings?.annualDiscountRate ?? DEFAULT_ANNUAL_DISCOUNT_RATE,
    durationDays: settings?.annualDurationDays ?? DEFAULT_ANNUAL_DURATION_DAYS,
  };
}

// Худалдан авах нөхцөлтэй багц. period "year" бол үнэ, хугацааг жилийнхээр сольж annual: true,
// periodDays (сарын урт) тэмдэглэнэ. Үйлчилгээний тоо сар бүрийнх хэвээр, сар солигдоход
// шинэчлэгдэнэ (createSubscription, купон, төлбөр бүгд үүгээр ажиллана).
// Жилээр санал болгохгүй багц (үнэгүй, хугацаагүй) бол null. pkg нь items-тэй байна.
export async function packageOffer(pkg, period = "month", db = prisma) {
  if (period !== "year") return pkg;
  const terms = annualTerms(pkg, await annualPlanSettings(db));
  if (!terms) return null;
  return {
    ...pkg,
    basePrice: terms.price,
    durationDays: terms.durationDays,
    annual: true,
    periodDays: terms.periodDays,
  };
}
