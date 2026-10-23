import { prisma } from "@/lib/prisma";
import { DEFAULT_MATCHING } from "./config";

const SETTINGS_ID = "matching";

// Онооны тохиргоо: админы хадгалсан утгууд анхны утгууд дээр давхарлагдана
export async function getMatchingConfig() {
  const row = await prisma.matchingSetting.findUnique({ where: { id: SETTINGS_ID } });
  return { ...DEFAULT_MATCHING, ...(row?.config ?? {}) };
}

export const saveMatchingConfig = (config, userId) =>
  prisma.matchingSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { config, updatedById: userId },
    create: { id: SETTINGS_ID, config, updatedById: userId },
  });

// Анхны утгад буцаана
export const resetMatchingConfig = () => prisma.matchingSetting.deleteMany({ where: { id: SETTINGS_ID } });
