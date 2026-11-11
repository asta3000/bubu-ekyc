import { prisma } from "@/lib/prisma";
import { uniqueCode } from "@/lib/codes";

// Байгууллагын давхардаагүй промо код
export const uniquePromoCode = () =>
  uniqueCode(async (code) => Boolean(await prisma.promo.findUnique({ where: { code }, select: { id: true } })));

// Санал болгосон (урьсан) байгууллагын промо кодыг шалгана. organizationId: кодыг ашиглах
// байгууллага (шинэ бол null). Буцаах: { promoId } эсвэл { error: "мессеж" }
export async function findReferralPromo(code, organizationId = null) {
  const promo = await prisma.promo.findUnique({
    where: { code: String(code).trim().toUpperCase() },
    select: { id: true, organizationId: true, organization: { select: { status: true, contractSigned: true } } },
  });
  if (!promo?.organizationId) return { error: "Промо код олдсонгүй" };
  if (promo.organizationId === organizationId) return { error: "Байгууллага өөрийнхөө промо кодыг ашиглах боломжгүй" };
  if (promo.organization.status !== "ACTIVE") return { error: "Промо кодын эзэн байгууллага идэвхгүй байна" };
  // Гэрээ байгуулаагүй байгууллагын промо код идэвхгүй
  if (!promo.organization.contractSigned) return { error: "Промо кодын эзэн байгууллага гэрээ байгуулаагүй тул кодыг ашиглах боломжгүй" };
  return { promoId: promo.id };
}

// Анхны бодит төлбөр (QPay, банк) хийгдсэний дараа санал болгогчийг өөрчлөхгүй: урамшуулал
// аль хэдийн олгогдсон байж болно
export async function referralLocked(organizationId) {
  const paid = await prisma.payment.findFirst({
    where: { organizationId, status: "PAID", method: { in: ["QPAY", "BANK_TRANSFER"] } },
    select: { id: true },
  });
  return Boolean(paid);
}
