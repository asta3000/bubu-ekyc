import { prisma } from "@/lib/prisma";
import { fieldError, parseBody } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { findReferralPromo, referralLocked } from "@/lib/promo";
import { referralCodeSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Бүртгүүлэхдээ промо код оруулаагүй байгууллага дараа нь урьсан байгууллагынхаа кодыг
// нэг удаа оруулна (зөвхөн ORG_ADMIN). Оруулсан эсвэл анхны бодит төлбөрөө (QPay, банк)
// хийсэн бол өөрчлөхгүй, шаардлагатай бол системийн админ засна.
export async function POST(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;
  if (session.user.role !== "ORG_ADMIN") {
    return Response.json({ error: "Зөвхөн байгууллагын админ промо код оруулна" }, { status: 403 });
  }

  const { data, error: invalid } = await parseBody(request, referralCodeSchema);
  if (invalid) return invalid;

  const current = await prisma.organization.findUnique({
    where: { id: organization.id },
    select: { referralPromoId: true },
  });
  if (current.referralPromoId) return fieldError("referralCode", "Промо код аль хэдийн оруулсан байна");
  if (await referralLocked(organization.id)) {
    return fieldError("referralCode", "Төлбөр төлсний дараа промо код оруулах боломжгүй. Админд хандана уу.");
  }
  const { promoId, error: promoError } = await findReferralPromo(data.referralCode, organization.id);
  if (promoError) return fieldError("referralCode", promoError);

  // Зэрэг хоёр хүсэлт ирэхэд нэг л удаа оноогдоно
  const { count } = await prisma.organization.updateMany({
    where: { id: organization.id, referralPromoId: null },
    data: { referralPromoId: promoId },
  });
  if (!count) return fieldError("referralCode", "Промо код аль хэдийн оруулсан байна");

  await logAudit({
    action: "organization.referral_set",
    actor: session.user,
    organizationId: organization.id,
    entity: { type: "Organization", id: organization.id },
    summary: `Урьсан байгууллагын промо код ${data.referralCode} оруулав`,
    metadata: { referralCode: data.referralCode },
  });
  return Response.json({ message: "Промо код амжилттай бүртгэгдлээ" });
}
