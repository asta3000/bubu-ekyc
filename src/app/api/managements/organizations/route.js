import { prisma } from "@/lib/prisma";
import { prismaErrorResponse } from "@/lib/api";
import { deleteBlob } from "@/lib/blob";
import { newOrganizationDefaults } from "@/lib/organizations";
import { requireAdminApi } from "@/lib/session";
import { ORGANIZATION_ERRORS, parseOrganizationForm, resolveReferral, storeLogo } from "./shared";
import { logAudit } from "@/lib/audit/log";

export async function POST(request) {
  const { error, session } = await requireAdminApi();
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
      // Шинэ байгууллага бүрт харилцагчийн дугаар, промо код, хэтэвч үүсгэнэ
      data: {
        ...data,
        ...(await newOrganizationDefaults(referralRate ?? undefined)),
        logo: logoUrl,
        referralPromoId: referral.referralPromoId,
      },
      select: { id: true },
    });
    await logAudit({
      action: "organization.create",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "Organization", id: organization.id },
      summary: `"${data.name}" байгууллага үүсгэв`,
      metadata: { ...data, referralCode, referralRate },
    });
    return Response.json({ organization }, { status: 201 });
  } catch (err) {
    // Бүртгэл үүсээгүй тул хуулсан файлыг устгана
    await deleteBlob(logoUrl);
    return prismaErrorResponse(err, ORGANIZATION_ERRORS);
  }
}
