import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireRoleApi, requireSessionApi, requireSessionPage } from "@/lib/session";

// Байгууллагын хэрэгслүүдийн (хориг тулгах, иргэний баталгаажуулалт) эрх:
// админ, эсвэл идэвхтэй байгууллагад харьяалагдах хэрэглэгч.
// Байгууллагыг DB-ээс шалгана (token-д хуучин мэдээлэл байж болно).
// { organization } эсвэл { error: "мессеж" } буцаана. Админд organization нь null байж болно.
async function resolveAccess(user) {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organization: { select: { id: true, name: true, status: true } } },
  });
  const organization = dbUser?.organization ?? null;
  if (user.role === "ADMIN") return { organization };
  if (!organization) return { error: "Таны бүртгэл байгууллагад холбогдоогүй байна. Админд хандана уу." };
  if (organization.status !== "ACTIVE") return { error: "Таны байгууллага идэвхгүй байна. Админд хандана уу." };
  return { organization };
}

// Хуудсанд: нэвтрээгүй бол /login. Эрхгүй бол accessError-тэй буцаана (хуудас мессеж харуулна).
export async function requireOrganizationPage() {
  const session = await requireSessionPage();
  const { organization, error } = await resolveAccess(session.user);
  return { session, organization, accessError: error ?? null };
}

// API-д: { session, organization } эсвэл алдааны { error } Response
export async function requireOrganizationApi() {
  const { error, session } = await requireSessionApi();
  if (error) return { error };
  const access = await resolveAccess(session.user);
  if (access.error) return { error: Response.json({ error: access.error }, { status: 403 }) };
  return { session, organization: access.organization };
}

// Байгууллагын өөрийн жагсаалтын хуудсанд: зөвхөн ORG_ADMIN (системийн ADMIN ч биш).
// Бусад эрхтэй бол /login руу (proxy өөрийн хуудас руу нь шилжүүлнэ).
export async function requireOrgAdminPage() {
  const session = await requireSessionPage();
  if (session.user.role !== "ORG_ADMIN") redirect("/login");
  const { organization, error } = await resolveAccess(session.user);
  return { session, organization, accessError: error ?? null };
}

// API-д: { session, organization } эсвэл алдааны { error } Response
export async function requireOrgAdminApi() {
  const { error, session } = await requireRoleApi(["ORG_ADMIN"]);
  if (error) return { error };
  const access = await resolveAccess(session.user);
  if (access.error) return { error: Response.json({ error: access.error }, { status: 403 }) };
  return { session, organization: access.organization };
}

// Түүх (тулгалт, баталгаажуулалт): админ бүгдийг, байгууллагын хэрэглэгч өөрийн байгууллагынхыг харна
export const organizationScope = (session, organization) =>
  session.user.role === "ADMIN" ? {} : { organizationId: organization.id };
