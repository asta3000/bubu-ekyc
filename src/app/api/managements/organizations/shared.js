import { prisma } from "@/lib/prisma";
import { fieldError, notDeleted } from "@/lib/api";
import { uploadLogo } from "@/lib/blob";
import { DUPLICATE_NAME, DUPLICATE_REGISTER, registerNumberTaken } from "@/lib/organizations";
import { fieldErrors, logoFileError, organizationSchema, referralRateSchema } from "@/lib/validations";

export const ORGANIZATION_ERRORS = {
  notFound: "Байгууллага олдсонгүй",
  unique: { field: "name", message: DUPLICATE_NAME },
};

// Multipart form: name, registerNumber, contractSigned ("1"), address, email, backupEmail, phone,
// backupPhone, operationId, status, logo (файл, заавал биш), removeLogo ("1"),
// referralCode (санал болгосон байгууллагын промо код, заавал биш),
// referralRate (энэ байгууллагын промо кодоор олгох урамшууллын хувь, заавал биш).
// organizationId: засаж буй байгууллага (шинэ бол null).
// { data, logo, removeLogo, referralCode, referralRate } эсвэл алдааны { error } Response буцаана.
export async function parseOrganizationForm(request, organizationId = null) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return { error: fieldError("form", "Хүсэлт буруу байна") };

  // Хоосон зайтай утгыг хоосон гэж үзнэ (заавал биш талбарт null болно)
  const text = (key) => String(formData.get(key) ?? "").trim() || undefined;
  const parsed = organizationSchema.safeParse({
    name: formData.get("name") ?? undefined,
    registerNumber: text("registerNumber"),
    contractSigned: formData.get("contractSigned") === "1",
    address: text("address"),
    email: text("email"),
    backupEmail: text("backupEmail"),
    phone: text("phone"),
    backupPhone: text("backupPhone"),
    operationId: formData.get("operationId") ?? undefined,
    status: formData.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return { error: Response.json({ errors: fieldErrors(parsed.error) }, { status: 400 }) };
  }

  // Файл сонгоогүй үед браузер хоосон (size 0) File илгээнэ
  const file = formData.get("logo");
  const logo = file instanceof File && file.size > 0 ? file : null;
  if (logo) {
    const message = logoFileError(logo);
    if (message) return { error: fieldError("logo", message) };
  }

  const operationError = await checkOperation(parsed.data.operationId);
  if (operationError) return { error: operationError };

  if (await registerNumberTaken(parsed.data.registerNumber, organizationId)) {
    return { error: fieldError("registerNumber", DUPLICATE_REGISTER, 409) };
  }

  // Хоосон бол өөрчлөхгүй (шинэ байгууллагад анхдагч хувь)
  const rateValue = String(formData.get("referralRate") ?? "").trim();
  const rate = rateValue ? referralRateSchema.safeParse(rateValue) : null;
  if (rate && !rate.success) return { error: fieldError("referralRate", rate.error.issues[0].message) };

  return {
    data: parsed.data,
    logo,
    removeLogo: formData.get("removeLogo") === "1",
    referralCode: String(formData.get("referralCode") ?? "").trim().toUpperCase() || null,
    referralRate: rate?.data ?? null,
  };
}

// Санал болгосон байгууллагын промо кодыг шалгана. organizationId: засаж буй байгууллага
// (шинэ бол null). { referralPromoId } эсвэл алдааны { error } Response.
export async function resolveReferral(code, organizationId = null) {
  if (!code) return { referralPromoId: null };
  const promo = await prisma.promo.findUnique({
    where: { code },
    select: { id: true, organizationId: true, organization: { select: { status: true } } },
  });
  if (!promo?.organizationId) return { error: fieldError("referralCode", "Промо код олдсонгүй") };
  if (promo.organizationId === organizationId) {
    return { error: fieldError("referralCode", "Байгууллага өөрийнхөө промо кодыг ашиглах боломжгүй") };
  }
  if (promo.organization.status !== "ACTIVE") {
    return { error: fieldError("referralCode", "Промо кодын эзэн байгууллага идэвхгүй байна") };
  }
  return { referralPromoId: promo.id };
}

// Анхны бодит төлбөр (QPay, банк) хийгдсэний дараа санал болгогчийг өөрчлөхгүй
export async function referralLocked(organizationId) {
  const paid = await prisma.payment.findFirst({
    where: { organizationId, status: "PAID", method: { in: ["QPAY", "BANK_TRANSFER"] } },
    select: { id: true },
  });
  return Boolean(paid);
}

// Логог storage-д хадгална: { url } эсвэл алдааны { error } Response
export async function storeLogo(file) {
  try {
    return { url: await uploadLogo(file) };
  } catch (error) {
    console.error("[blob] upload:", error.message);
    return { error: fieldError("logo", "Лого хадгалж чадсангүй, дахин оролдоно уу", 502) };
  }
}

// Сонгосон үйл ажиллагаа байгаа эсэх. Алдаатай бол Response, зөв бол null.
async function checkOperation(operationId) {
  if (!operationId) return null;
  const operation = await prisma.operation.findFirst({
    where: { id: operationId, ...notDeleted },
    select: { id: true },
  });
  return operation ? null : fieldError("operationId", "Үйл ажиллагаа олдсонгүй");
}
