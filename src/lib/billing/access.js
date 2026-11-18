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

// Багцын тохиргоо (автомат сунгалт, ахиулах, бууруулах): зөвхөн байгууллагын админ
export async function requireBillingAdminApi() {
  const access = await requireBillingApi();
  if (access.error) return access;
  if (access.session.user.role !== "ORG_ADMIN") {
    return { error: Response.json({ error: "Зөвхөн байгууллагын админ өөрчилнө" }, { status: 403 }) };
  }
  return access;
}
