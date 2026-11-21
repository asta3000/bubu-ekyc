import { requireOrganizationApi } from "@/lib/organization-access";

// Төлбөрийн API-д: байгууллагатай хэрэглэгч л (байгууллагагүй админд хэтэвч байхгүй)
export async function requireBillingApi() {
  const access = await requireOrganizationApi();
  if (access.error) return access;
  if (!access.organization) {
    return { error: Response.json({ error: "Таны бүртгэл байгууллагад холбогдоогүй байна" }, { status: 403 }) };
  }
  return access;
}

// Борлуулалтыг дэмжих үйлдэл (худалдан авах, сунгах, ахиулах, автомат сунгалт сэргээх,
// бууруулах захиалга цуцлах) байгууллагын бүх хэрэглэгчид нээлттэй. Борлуулалтыг хязгаарлах
// үйлдэл (автомат сунгалт зогсоох, бууруулах, ахиулах захиалга цуцлах) зөвхөн байгууллагын админ.
const ADMIN_ONLY = { error: "Энэ үйлдлийг зөвхөн байгууллагын админ хийнэ" };

export const isOrgAdmin = (session) => session.user.role === "ORG_ADMIN";

// Хүсэлт борлуулалтыг хязгаарлах үед (restricts = true) админ биш бол 403 Response, бусад үед null
export const adminOnlyError = (session, restricts = true) =>
  restricts && !isOrgAdmin(session) ? Response.json(ADMIN_ONLY, { status: 403 }) : null;

// Борлуулалтыг хязгаарлах үйлдэл: зөвхөн байгууллагын админ
export async function requireBillingAdminApi() {
  const access = await requireBillingApi();
  if (access.error) return access;
  const denied = adminOnlyError(access.session);
  return denied ? { error: denied } : access;
}
