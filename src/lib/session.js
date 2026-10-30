import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Server component-д session унших. Auth.js дотроо crypto ашигладаг тул
// cacheComponents-ийн prerender-ээс гаргаж, request үед уншина.
export async function getSession() {
  await connection();
  return auth();
}

// Хуудсанд: нэвтрээгүй бол /login (proxy шилжүүлдэг ч хуудас өөрөө ч шалгана)
export async function requireSessionPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session;
}

// Админы хуудсанд: нэвтрээгүй бол /login, эрх хүрэхгүй бол /login (proxy өөрийн хуудас руу шилжүүлнэ)
export async function requireAdminPage() {
  const session = await requireSessionPage();
  if (session.user.role !== "ADMIN") redirect("/login");
  return session;
}

// Route handler-уудад: нэвтрээгүй бол алдааны Response, нэвтэрсэн бол session буцаана.
// Proxy-оос гадна API өөрөө ч шалгана. Token 15 минут хүртэл хуучирч болох тул хэрэглэгчийн
// төлөв, эрх, байгууллагыг DB-ээс уншиж давхарлана: идэвхгүй болгосон эсвэл эрхийг нь
// бууруулсан хэрэглэгч тэр даруй үйлдэл хийх боломжгүй болно.
export async function requireSessionApi() {
  const session = await auth();
  if (!session?.user) {
    return { error: Response.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, role: true, organizationId: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return { error: Response.json({ error: "Таны бүртгэл идэвхгүй байна" }, { status: 403 }) };
  }
  return { session: { ...session, user: { ...session.user, role: user.role, organizationId: user.organizationId } } };
}

// Эрх хүрэхгүй бол алдааны Response, хүрвэл session буцаана
export async function requireRoleApi(roles) {
  const { error, session } = await requireSessionApi();
  if (error) return { error };
  if (!roles.includes(session.user.role)) {
    return { error: Response.json({ error: "Хандах эрхгүй" }, { status: 403 }) };
  }
  return { session };
}

export const requireAdminApi = () => requireRoleApi(["ADMIN"]);
