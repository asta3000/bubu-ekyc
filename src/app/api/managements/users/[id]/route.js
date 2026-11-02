import { prisma } from "@/lib/prisma";
import { fieldError, notDeleted, parseBody, prismaErrorResponse } from "@/lib/api";
import { requireAdminApi } from "@/lib/session";
import { manageUserSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

const USER_FIELDS = { role: "эрх", status: "төлөв", organizationId: "байгууллага" };

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

  const before = await prisma.user.findUnique({
    where: { id },
    select: { email: true, role: true, status: true, organizationId: true },
  });
  try {
    const user = await prisma.user.update({
      where: { id, ...notDeleted },
      data,
      select: { id: true },
    });
    const changes = diffChanges(before, data);
    // Байгууллага солигдсон бол хоёр байгууллагын лог-д хоёуланд нь харагдана
    for (const organizationId of new Set([before?.organizationId ?? null, data.organizationId ?? null])) {
      await logAudit({
        action: "user.update",
        actor: session.user,
        organizationId,
        entity: { type: "User", id },
        summary: `${before?.email} хэрэглэгчийн ${Object.keys(changes ?? {}).map((key) => USER_FIELDS[key] ?? key).join(", ") || "мэдээлэл"}-ийг өөрчлөв`,
        changes,
      });
    }
    return Response.json({ user });
  } catch (err) {
    return prismaErrorResponse(err, { notFound: "Хэрэглэгч олдсонгүй" });
  }
}
