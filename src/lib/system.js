import { prisma } from "@/lib/prisma";

export const SYSTEM_NAME = "e-KYC";

const SETTINGS_ID = "system";

// Админ тохируулаагүй үеийн анхны утгууд
const DEFAULTS = {
  purpose: "Харилцагчийг таньж мэдэх (KYC), хоригийн жагсаалттай тулгах систем",
  website: process.env.AUTH_URL ?? "",
  email: "",
  phone: "",
  address: "",
  linkedin: "",
  facebook: "",
  instagram: "",
};

// Системийн мэдээлэл: админы тохиргоо, хоосон талбарт анхны утга (хэвлэх тайлангийн толгойд)
export async function getSystemInfo() {
  const settings = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  const info = { name: SYSTEM_NAME };
  for (const [key, fallback] of Object.entries(DEFAULTS)) info[key] = settings?.[key] || fallback;
  return info;
}

// Админы засах form-д: хадгалсан утгууд (анхны утгагүй)
export const getSystemSettings = () => prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });

export const saveSystemSettings = (data, userId) =>
  prisma.systemSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { ...data, updatedById: userId },
    create: { id: SETTINGS_ID, ...data, updatedById: userId },
  });
