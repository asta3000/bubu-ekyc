import { prisma } from "@/lib/prisma";
import { parseBody, prismaErrorResponse } from "@/lib/api";
import { requireOrgAdminApi } from "@/lib/organization-access";
import { sanctionListSchema } from "@/lib/validations";
import { LIST_ERRORS } from "./shared";

// Байгууллагын өөрийн жагсаалт үүсгэнэ (зөвхөн ORG_ADMIN)
export async function POST(request) {
  const { error, session, organization } = await requireOrgAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, sanctionListSchema);
  if (invalid) return invalid;

  try {
    const list = await prisma.sanctionList.create({
      data: { ...data, organizationId: organization.id, createdById: session.user.id },
      select: { id: true },
    });
    return Response.json({ list }, { status: 201 });
  } catch (err) {
    return prismaErrorResponse(err, LIST_ERRORS);
  }
}
