import { prisma } from "@/lib/prisma";
import { notFound, parseBody } from "@/lib/api";
import { ADDON_SOURCE_KEYS, sanctionSource } from "@/lib/sanctions/sources";
import { requireAdminApi } from "@/lib/session";
import { sourceAddonSchema } from "@/lib/validations";
import { diffChanges, logAudit } from "@/lib/audit/log";

// Улсын нэмэлт жагсаалтын үнэ, хугацаа, төлөвийг тохируулна. Өөрчлөлт зөвхөн шинэ
// худалдан авалтад нөлөөлнө (худалдаж авсан хугацаа хэвээр).
export async function PUT(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { source } = await ctx.params;
  if (!ADDON_SOURCE_KEYS.includes(source)) return notFound("Нэмэлт жагсаалт олдсонгүй");

  const { data, error: invalid } = await parseBody(request, sourceAddonSchema);
  if (invalid) return invalid;

  const before = await prisma.sourceAddon.findUnique({
    where: { source },
    select: { price: true, durationDays: true, status: true },
  });
  await prisma.sourceAddon.upsert({ where: { source }, update: data, create: { source, ...data } });
  await logAudit({
    action: "addon.update",
    actor: session.user,
    organizationId: null,
    entity: { type: "SourceAddon", id: source },
    summary: `${sanctionSource(source).name} нэмэлт жагсаалтын тохиргоог өөрчлөв`,
    changes: diffChanges(before, data),
  });
  return Response.json({ ok: true });
}
