import { prisma } from "@/lib/prisma";
import { fieldError, notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { manageUserSchema } from "@/lib/validations";

// Хэрэглэгчийн байгууллага, эрх, төлөвийг өөрчилнө. Хэрэглэгчийн token
// дараагийн refresh-ээр (ACCESS_TOKEN_MAX_AGE) шинэчлэгдэнэ.
export async function PATCH(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, manageUserSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  // Админ өөрийгөө эрхгүй болгож түгжигдэхээс сэргийлнэ
  if (id === session.user.id && (data.role !== "ADMIN" || data.status !== "ACTIVE")) {
    return Response.json(
      { errors: { form: "Өөрийн эрх, төлөвийг өөрчлөх боломжгүй" } },
      { status: 400 },
    );
  }

  // Байгууллагын админ байгууллагынхаа жагсаалтыг удирддаг тул байгууллагагүй байж болохгүй
  if (data.role === "ORG_ADMIN" && !data.organizationId) {
    return fieldError("organizationId", "Байгууллагын админд байгууллага сонгоно уу");
  }

  if (data.organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { id: data.organizationId, ...notDeleted },
      select: { id: true },
    });
    if (!organization) return fieldError("organizationId", "Байгууллага олдсонгүй");
  }

  try {
    const user = await prisma.user.update({
      where: { id, ...notDeleted },
      data,
      select: { id: true },
    });
    return Response.json({ user });
  } catch (err) {
    return prismaErrorResponse(err, { notFound: "Хэрэглэгч олдсонгүй" });
  }
}
