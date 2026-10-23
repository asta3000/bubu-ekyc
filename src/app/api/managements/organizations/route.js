import { prisma } from "@/lib/prisma";
import { prismaErrorResponse } from "@/lib/api";
import { deleteBlob } from "@/lib/blob";
import { uniquePromoCode } from "@/lib/promo";
import { DEFAULT_REFERRAL_RATE } from "@/lib/validations";
import { requireAdminApi } from "@/lib/session";
import { ORGANIZATION_ERRORS, parseOrganizationForm, resolveReferral, storeLogo } from "./shared";

export async function POST(request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { data, logo, referralCode, referralRate, error: invalid } = await parseOrganizationForm(request);
  if (invalid) return invalid;
  const referral = await resolveReferral(referralCode);
  if (referral.error) return referral.error;

  let logoUrl = null;
  if (logo) {
    const stored = await storeLogo(logo);
    if (stored.error) return stored.error;
    logoUrl = stored.url;
  }

  try {
    const organization = await prisma.organization.create({
      // Шинэ байгууллага бүрт промо код, хэтэвч үүсгэнэ
      data: {
        ...data,
        logo: logoUrl,
        referralPromoId: referral.referralPromoId,
        promos: { create: { code: await uniquePromoCode(), discount: referralRate ?? DEFAULT_REFERRAL_RATE } },
        wallet: { create: {} },
      },
      select: { id: true },
    });
    return Response.json({ organization }, { status: 201 });
  } catch (err) {
    // Бүртгэл үүсээгүй тул хуулсан файлыг устгана
    await deleteBlob(logoUrl);
    return prismaErrorResponse(err, ORGANIZATION_ERRORS);
  }
}
