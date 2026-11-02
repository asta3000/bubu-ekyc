import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/api";
import { diffChanges, logAudit } from "@/lib/audit/log";
import { ORG_ROLE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { requireOrgAdminApi } from "@/lib/organization-access";
import { orgManageUserSchema } from "@/lib/validations";
import { findManagedUser } from "../shared";

// Байгууллагын админ хэрэглэгчийн эрх (хэрэглэгч / байгууллагын админ), төлөвийг өөрчилнө.
// Хэрэглэгчийн token дараагийн refresh-ээр шинэчлэгдэнэ; идэвхгүй болсон бол session дуусна.
export async function PATCH(request, ctx) {
  const { error, session, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, orgManageUserSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const { user, error: denied } = await findManagedUser(session, organization, id);
  if (denied) return denied;

  await prisma.user.update({ where: { id }, data });
  const changes = diffChanges(user, data);
  if (changes) {
    const describe = [
      changes.role && `эрхийг "${ORG_ROLE_LABELS[data.role]}"`,
      changes.status && `төлөвийг "${STATUS_LABELS[data.status]}"`,
    ].filter(Boolean);
    await logAudit({
      action: "user.update",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "User", id },
      summary: `${user.email} хэрэглэгчийн ${describe.join(", ")} болгов`,
      changes,
    });
  }
  return Response.json({ message: "Хадгалагдлаа" });
}
