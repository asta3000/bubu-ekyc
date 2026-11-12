import { prisma } from "@/lib/prisma";

// Үнэгүй (суурь үнэ 0) багцын ашиглалтын хязгаар. Анхны идэвхжүүлэлт + админы тохируулсан
// тооны сунгалт (автомат болон гараар). Жишээ нь сунгалт 4 бол нийт 5 удаа, 6 дахь нь хаагдана.
// Байгууллагын бүх үнэгүй багцын идэвхжсэн захиалгыг нийлүүлж тоолно (нэг үнэгүй багцаас нөгөөд
// шилжиж хязгаарыг тойрохгүй). Купоноор 0 болсон төлбөртэй багц тоонд орохгүй (захиалгын
// basePrice нь багцын үнийн хуулбар).

export const DEFAULT_FREE_RENEWAL_LIMIT = 2;

// Админы тохиргоо, тохируулаагүй бол анхдагч
export async function freeRenewalLimit(db = prisma) {
  const settings = await db.systemSetting.findUnique({ where: { id: "system" }, select: { freeRenewalLimit: true } });
  return settings?.freeRenewalLimit ?? DEFAULT_FREE_RENEWAL_LIMIT;
}

// Буцаах: { used, allowed, exhausted }
export async function freePlanUsage(organizationId, db = prisma) {
  const [used, limit] = await Promise.all([
    db.subscription.count({
      where: { organizationId, basePrice: 0, status: { in: ["ACTIVE", "ENDED"] }, startsAt: { not: null } },
    }),
    freeRenewalLimit(db),
  ]);
  const allowed = limit + 1;
  return { used, allowed, exhausted: used >= allowed };
}

// Эрх дууссаны дараах мессеж: гэрээгүй бол гэрээ байгуулах, гэрээтэй бол хэтэвч цэнэглэх
export const freePlanExhaustedMessage = (contractSigned) =>
  contractSigned
    ? "Үнэгүй багцын ашиглах эрх дууссан. Хэтэвчээ цэнэглээд, багцаа ахиулж ашиглаарай."
    : "Үнэгүй багцын ашиглах эрх дууссан. Гэрээгээ байгуулаад, багцаа ахиулж ашиглаарай.";

// Үнэгүй багцыг дахин идэвхжүүлэх (сунгах) боломжгүй бол мессеж, боломжтой бол null
export async function freePlanBlock(pkg, organizationId, db = prisma) {
  if (pkg.basePrice !== 0) return null;
  const { exhausted } = await freePlanUsage(organizationId, db);
  if (!exhausted) return null;
  const organization = await db.organization.findUnique({ where: { id: organizationId }, select: { contractSigned: true } });
  return freePlanExhaustedMessage(organization?.contractSigned);
}

// Байгууллагын сүүлийн багц үнэгүй байсан бөгөөд эрх нь дууссан бол мессеж, үгүй бол null
// (идэвхтэй багцгүй үед "яагаад" гэдгийг харуулахад)
export async function freePlanEnded(organizationId, db = prisma) {
  const last = await db.subscription.findFirst({
    where: { organizationId, status: { in: ["ACTIVE", "ENDED"] }, startsAt: { not: null } },
    orderBy: { startsAt: "desc" },
    select: { basePrice: true, organization: { select: { contractSigned: true } } },
  });
  if (last?.basePrice !== 0 || !(await freePlanUsage(organizationId, db)).exhausted) return null;
  return freePlanExhaustedMessage(last.organization.contractSigned);
}
