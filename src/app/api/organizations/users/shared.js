import { prisma } from "@/lib/prisma";
import { notDeleted, notFound } from "@/lib/api";

// Байгууллагын админ зөвхөн өөрийн байгууллагын, системийн ADMIN биш, өөр хэрэглэгчийг
// удирдана (өөрийгөө эрхгүй болгож түгжигдэхээс сэргийлнэ).
// { user } эсвэл алдааны { error } Response
export async function findManagedUser(session, organization, id) {
  if (id === session.user.id) {
    return { error: Response.json({ errors: { form: "Өөрийн бүртгэлийг энд өөрчлөх боломжгүй" } }, { status: 400 }) };
  }
  const user = await prisma.user.findFirst({
    where: { id, organizationId: organization.id, role: { not: "ADMIN" }, ...notDeleted },
    select: { id: true, email: true, role: true, status: true },
  });
  return user ? { user } : { error: notFound("Хэрэглэгч олдсонгүй") };
}
