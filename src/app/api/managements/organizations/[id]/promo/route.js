import { prisma } from "@/lib/prisma";
import { notDeleted, notFound } from "@/lib/api";
import { uniquePromoCode } from "@/lib/promo";
import { requireAdminApi } from "@/lib/session";

// Промо кодгүй (энэ боломж нэмэгдэхээс өмнө бүртгүүлсэн) байгууллагад нөхөж үүсгэнэ
export async function POST(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  const organization = await prisma.organization.findFirst({
    where: { id, ...notDeleted },
    select: { _count: { select: { promos: true } } },
  });
  if (!organization) return notFound("Байгууллага олдсонгүй");
  if (organization._count.promos > 0) {
    return Response.json({ error: "Энэ байгууллагад промо код аль хэдийн байна" }, { status: 409 });
  }

  const promo = await prisma.promo.create({
    data: { code: await uniquePromoCode(), organizationId: id },
    select: { code: true },
  });
  return Response.json({ promo }, { status: 201 });
}
