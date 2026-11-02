import { prisma } from "@/lib/prisma";
import { fieldError, notDeleted, notFound, prismaErrorResponse } from "@/lib/api";
import { deleteBlob } from "@/lib/blob";
import { uniqueCustomerNumber } from "@/lib/customer-number";
import { uniquePromoCode } from "@/lib/promo";
import { requireAdminApi } from "@/lib/session";
import { ORGANIZATION_ERRORS, parseOrganizationForm, referralLocked, resolveReferral, storeLogo } from "../shared";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Шинэ лого сонгосон эсвэл устгасан бол хуучин файлыг storage-оос устгана
export async function PATCH(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  const { data, logo, removeLogo, referralCode, referralRate, error: invalid } = await parseOrganizationForm(request, id);
  if (invalid) return invalid;

  const existing = await prisma.organization.findFirst({
    where: { id, ...notDeleted },
    include: {
      referralPromo: { select: { code: true } },
      promos: { orderBy: { createdAt: "desc" }, take: 1, select: { discount: true } },
    },
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
      data: {
        ...data,
        logo: logoUrl,
        referralPromoId: referral.referralPromoId,
        // Энэ талбар нэмэгдэхээс өмнө бүртгэгдсэн байгууллагад нөхөж үүсгэнэ
        ...(!existing.customerNumber && { customerNumber: await uniqueCustomerNumber() }),
      },
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
    await logAudit({
      action: "organization.update",
      actor: session.user,
      organizationId: id,
      entity: { type: "Organization", id },
      summary: `"${data.name}" байгууллагын мэдээллийг өөрчлөв`,
      changes: diffChanges(
        {
          ...existing,
          referralCode: existing.referralPromo?.code ?? null,
          referralRate: existing.promos[0]?.discount ?? null,
          logo: Boolean(existing.logo),
        },
        {
          ...data,
          referralCode: referralCode,
          referralRate: referralRate ?? existing.promos[0]?.discount ?? null,
          logo: Boolean(logoUrl),
        },
      ),
    });
    return Response.json({ organization });
  } catch (err) {
    if (logo) await deleteBlob(logoUrl);
    return prismaErrorResponse(err, ORGANIZATION_ERRORS);
  }
}

// Soft delete. Байгууллагын хэрэглэгчдийг байгууллагаас салгана.
export async function DELETE(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await prisma.$transaction([
      prisma.user.updateMany({ where: { organizationId: id }, data: { organizationId: null } }),
      prisma.organization.update({ where: { id, ...notDeleted }, data: { status: "DELETED" } }),
    ]);
    const { name } = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
    await logAudit({
      action: "organization.delete",
      actor: session.user,
      organizationId: id,
      entity: { type: "Organization", id },
      summary: `"${name}" байгууллагыг устгав`,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return prismaErrorResponse(err, ORGANIZATION_ERRORS);
  }
}
