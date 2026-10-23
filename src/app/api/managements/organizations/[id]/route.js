import { prisma } from "@/lib/prisma";
import { fieldError, notDeleted, notFound, prismaErrorResponse } from "@/lib/api";
import { deleteBlob } from "@/lib/blob";
import { uniquePromoCode } from "@/lib/promo";
import { requireAdminApi } from "@/lib/session";
import { ORGANIZATION_ERRORS, parseOrganizationForm, referralLocked, resolveReferral, storeLogo } from "../shared";

// Шинэ лого сонгосон эсвэл устгасан бол хуучин файлыг storage-оос устгана
export async function PATCH(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, logo, removeLogo, referralCode, referralRate, error: invalid } = await parseOrganizationForm(request);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const existing = await prisma.organization.findFirst({
    where: { id, ...notDeleted },
    select: { logo: true, referralPromoId: true, referralPromo: { select: { code: true } } },
  });
  if (!existing) return notFound(ORGANIZATION_ERRORS.notFound);

  // Код өөрчлөгдөөгүй бол дахин шалгахгүй (санал болгогч идэвхгүй болсон ч бусад талбарыг засна)
  const referral =
    referralCode && referralCode === existing.referralPromo?.code
      ? { referralPromoId: existing.referralPromoId }
      : await resolveReferral(referralCode, id);
  if (referral.error) return referral.error;
  if (referral.referralPromoId !== existing.referralPromoId && (await referralLocked(id))) {
    return fieldError("referralCode", "Төлбөр хийгдсэн тул санал болгосон байгууллагыг өөрчлөх боломжгүй");
  }

  let logoUrl = removeLogo ? null : existing.logo;
  if (logo) {
    const stored = await storeLogo(logo);
    if (stored.error) return stored.error;
    logoUrl = stored.url;
  }

  try {
    const organization = await prisma.organization.update({
      where: { id, ...notDeleted },
      data: { ...data, logo: logoUrl, referralPromoId: referral.referralPromoId },
      select: { id: true },
    });
    // Урамшууллын хувь байгууллагын бүх промо кодонд; цаашдын төлбөрөөс үйлчилнэ.
    // Промо кодгүй бол тохируулсан хувиар нь үүсгэнэ (хувь алдагдахгүй).
    if (referralRate != null) {
      const { count } = await prisma.promo.updateMany({ where: { organizationId: id }, data: { discount: referralRate } });
      if (!count) {
        await prisma.promo.create({ data: { code: await uniquePromoCode(), organizationId: id, discount: referralRate } });
      }
    }
    if (existing.logo !== logoUrl) await deleteBlob(existing.logo);
    return Response.json({ organization });
  } catch (err) {
    if (logo) await deleteBlob(logoUrl);
    return prismaErrorResponse(err, ORGANIZATION_ERRORS);
  }
}

// Soft delete. Байгууллагын хэрэглэгчдийг байгууллагаас салгана.
export async function DELETE(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.$transaction([
      prisma.user.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
      prisma.organization.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } }),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, ORGANIZATION_ERRORS);
  }
}
