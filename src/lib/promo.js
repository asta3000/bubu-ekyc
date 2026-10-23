import { prisma } from "@/lib/prisma";
import { uniqueCode } from "@/lib/codes";

// Байгууллагын давхардаагүй промо код
export const uniquePromoCode = () =>
  uniqueCode(async (code) => Boolean(await prisma.promo.findUnique({ where: { code }, select: { id: true } })));
