import { prisma } from "@/lib/prisma";
import { fieldError, notFound, parseBody } from "@/lib/api";
import { formatDateTime, personName } from "@/lib/format";
import { organizationScope, requireOrganizationApi } from "@/lib/organization-access";
import { createPrint } from "@/lib/screening/prints";
import { printSchema } from "@/lib/validations";

// Тулгалтын нэг тохирлыг хэвлэхэд хэвлэлтийг бүртгэнэ. Буцаасан id-аар хэвлэх хуудсыг нээнэ.
// Зөвхөн тухайн байгууллагын (админ бол бүх) тулгалтыг хэвлэнэ.
export async function POST(request, ctx) {
  const { error, session, organization } = await requireOrganizationApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, printSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  const screening = await prisma.screening.findFirst({
    where: { id, ...organizationScope(session, organization) },
    select: { id: true, results: true },
  });
  if (!screening) return notFound("Тулгалт олдсонгүй");
  if (!Array.isArray(screening.results) || !screening.results[data.index]) {
    return fieldError("index", "Тохирол олдсонгүй", 404);
  }

  const print = await createPrint(
    {
      screeningId: screening.id,
      matchIndex: data.index,
      userId: session.user.id,
      organizationId: organization?.id ?? null,
    },
    { user: { select: { firstName: true, lastName: true } } },
  );
  return Response.json(
    {
      print: {
        id: print.id,
        number: print.documentNumber,
        by: personName(print.user),
        at: formatDateTime(print.createdAt),
      },
    },
    { status: 201 },
  );
}
