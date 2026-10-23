import { prisma } from "@/lib/prisma";
import { fieldError, notDeleted } from "@/lib/api";

// Тодорхой байгууллагад зориулсан купоны байгууллага байгаа эсэх. Алдаатай бол Response.
export async function checkCouponOrganization(organizationId) {
  if (!organizationId) return null;
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, ...notDeleted },
    select: { id: true },
  });
  return organization ? null : fieldError("organizationId", "Байгууллага олдсонгүй");
}

export const COUPON_ERRORS = {
  notFound: "Купон олдсонгүй",
  unique: { field: "code", message: "Энэ код бүртгэлтэй байна" },
};
