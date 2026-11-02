import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";
import { uniqueCustomerNumber } from "@/lib/customer-number";
import { uniquePromoCode } from "@/lib/promo";
import { DEFAULT_REFERRAL_RATE } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Устгагдсан байгууллага ч нэрээ хадгалдаг тул нэр давхцаж болно
export const DUPLICATE_NAME = "Энэ нэртэй байгууллага бүртгэлтэй байна";
export const DUPLICATE_REGISTER = "Энэ регистрийн дугаартай байгууллага бүртгэлтэй байна";

export async function nameTaken(name, organizationId = null) {
  const existing = await prisma.organization.findUnique({ where: { name }, select: { id: true } });
  return Boolean(existing && existing.id !== organizationId);
}

// Устгагдаагүй өөр байгууллага ижил регистртэй эсэх
export async function registerNumberTaken(registerNumber, organizationId = null) {
  const existing = await prisma.organization.findFirst({
    where: { registerNumber, ...notDeleted, ...(organizationId && { id: { not: organizationId } }) },
    select: { id: true },
  });
  return Boolean(existing);
}

// Шинэ байгууллага бүрт үүсгэх харилцагчийн дугаар, промо код, хэтэвч (prisma create-ийн data-д нэмнэ)
export const newOrganizationDefaults = async (referralRate = DEFAULT_REFERRAL_RATE) => ({
  customerNumber: await uniqueCustomerNumber(),
  promos: { create: { code: await uniquePromoCode(), discount: referralRate } },
  wallet: { create: {} },
});

// Гэрээ байгуулаагүй байгууллагад бүртгүүлэх хэрэглэгчийн анхдагч дээд тоо
export const DEFAULT_UNCONTRACTED_USER_LIMIT = 3;

// Гэрээгүй байгууллагын хэрэглэгчийн дээд тоо: админы тохиргоо, тохируулаагүй бол анхдагч
export async function uncontractedUserLimit() {
  const settings = await prisma.systemSetting.findUnique({
    where: { id: "system" },
    select: { uncontractedUserLimit: true },
  });
  return settings?.uncontractedUserLimit ?? DEFAULT_UNCONTRACTED_USER_LIMIT;
}

// Бүртгэлийн байгууллагын алхмыг шалгана (registerOrganizationSchema-аар задалсан data).
// Нэгдэх бол { organization: { id, name } }, шинэ бол { organization: null }, алдаатай бол { errors }.
export async function checkRegisterOrganization(data) {
  if (data.mode === "join") {
    const organization = await prisma.organization.findUnique({
      where: { customerNumber: data.customerNumber },
      select: { id: true, name: true, status: true, contractSigned: true },
    });
    if (!organization || organization.status === "DELETED") {
      return { errors: { customerNumber: "Энэ дугаартай байгууллага олдсонгүй" } };
    }
    if (organization.status !== "ACTIVE") {
      return { errors: { customerNumber: "Байгууллага идэвхгүй байна. Админд хандана уу." } };
    }
    // Гэрээ байгуулаагүй байгууллагад бүртгэлээр нэгдэх хэрэглэгчийн тоо хязгаартай
    if (!organization.contractSigned) {
      const [limit, users] = await Promise.all([
        uncontractedUserLimit(),
        prisma.user.count({ where: { organizationId: organization.id, ...notDeleted } }),
      ]);
      if (users >= limit) {
        return {
          errors: {
            customerNumber: `Гэрээ байгуулаагүй байгууллагад ${limit}-аас дээш хэрэглэгч бүртгэх боломжгүй. Байгууллагынхаа админд хандана уу.`,
          },
        };
      }
    }
    return { organization: { id: organization.id, name: organization.name } };
  }

  const [duplicateName, duplicateRegister] = await Promise.all([
    nameTaken(data.name),
    registerNumberTaken(data.registerNumber),
  ]);
  const errors = {
    ...(duplicateName && { name: DUPLICATE_NAME }),
    ...(duplicateRegister && { registerNumber: DUPLICATE_REGISTER }),
  };
  return Object.keys(errors).length ? { errors } : { organization: null };
}

// Хэрэглэгчийг бүртгэлийн байгууллагатай нь үүсгэнэ. Шинэ байгууллага бол (гэрээгүй) хамт
// нэг transaction-д үүсгэж ORG_ADMIN, бүртгэлтэй байгууллагад нэгдвэл ORGANIZATION эрхтэй.
// Өмнөх алхмаас хойш байгууллагын төлөв өөрчлөгдсөн байж болох тул дахин шалгана.
// { user } эсвэл { error: "мессеж" }. P2002 (давхардал)-ыг дуудагч тал шийднэ.
export async function createUserWithOrganization(input, userData, select = { id: true }) {
  const check = await checkRegisterOrganization(input);
  if (check.errors) return { error: Object.values(check.errors)[0] };

  if (check.organization) {
    const user = await prisma.user.create({
      data: { ...userData, role: "ORGANIZATION", organizationId: check.organization.id },
      select: { ...select, id: true },
    });
    await logAudit({
      action: "user.join",
      actor: { id: user.id },
      organizationId: check.organization.id,
      entity: { type: "User", id: user.id },
      summary: `${userData.email} харилцагчийн дугаараар байгууллагад нэгдэв`,
    });
    return { user };
  }

  const { mode, ...organization } = input;
  const defaults = await newOrganizationDefaults();
  const { user, organizationId } = await prisma.$transaction(async (tx) => {
    const { id } = await tx.organization.create({
      data: { ...organization, ...defaults, contractSigned: false },
      select: { id: true },
    });
    const created = await tx.user.create({
      data: { ...userData, role: "ORG_ADMIN", organizationId: id },
      select: { ...select, id: true },
    });
    return { user: created, organizationId: id };
  });
  await logAudit({
    action: "organization.register",
    actor: { id: user.id },
    organizationId,
    entity: { type: "Organization", id: organizationId },
    summary: `"${organization.name}" байгууллагыг бүртгүүлэв`,
    metadata: { ...organization, customerNumber: defaults.customerNumber },
  });
  return { user };
}
