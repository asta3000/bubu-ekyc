import { prisma } from "@/lib/prisma";
import { requestInfo } from "@/lib/request-info";
import { auditCategory } from "./actions";

// Хийсэн хүний мэдээллийг лог-д хуулбарлана. actor нь session.user эсвэл { id } (DB-ээс
// нөхнө) эсвэл { email } (хэрэглэгч олдоогүй нэвтрэлт г.м.) эсвэл null (систем, cron).
async function resolveActor(actor) {
  if (!actor) return {};
  let user = actor;
  if (actor.id && !actor.role) {
    user =
      (await prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
      })) ?? actor;
  }
  return {
    actorId: user.id ?? null,
    actorEmail: user.email ? String(user.email).toLowerCase() : null,
    actorName: user.lastName || user.firstName ? `${user.lastName ?? ""} ${user.firstName ?? ""}`.trim() : null,
    actorRole: user.role ?? null,
    organizationId: user.organizationId ?? null,
  };
}

// Үйлдлийг аудит логт бүртгэнэ. Лог бичих алдаа үндсэн үйлдлийг таслахгүй.
//   action:         "<ангилал>.<үйлдэл>" (src/lib/audit/actions.js)
//   actor:          session.user | { id } | { email } | null
//   organizationId: үйлдэл хамаарах байгууллага. Өгөөгүй бол хийсэн хүний байгууллага.
//   entity:         { type, id } өөрчлөгдсөн бичлэг
//   summary:        товч тайлбар (байгууллагын админд ч харагдана)
//   changes:        diffChanges(...) үр дүн
//   metadata:       бусад мэдээлэл (зөвхөн системийн админд)
//   status:         "SUCCESS" | "FAILURE"
export async function logAudit({
  action,
  actor = null,
  organizationId,
  entity = null,
  summary = null,
  changes = null,
  metadata = null,
  status = "SUCCESS",
}) {
  try {
    const resolved = await resolveActor(actor);
    await prisma.auditLog.create({
      data: {
        action,
        category: auditCategory(action),
        status,
        ...resolved,
        organizationId: organizationId === undefined ? resolved.organizationId ?? null : organizationId,
        entityType: entity?.type ?? null,
        entityId: entity?.id ?? null,
        summary: summary?.slice(0, 500) ?? null,
        changes: changes ?? undefined,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ...(await requestInfo()),
      },
    });
  } catch (error) {
    console.error(`[audit] ${action}:`, error.message);
  }
}

const comparable = (value) => (value instanceof Date ? value.toISOString() : value ?? null);

// Хоёр объектын ялгааг { field: { from, to } } болгоно. fields өгвөл зөвхөн тэдгээрийг.
// Нууц утгыг (password г.м.) хэзээ ч бүү дамжуул. Өөрчлөлтгүй бол null.
export function diffChanges(before, after, fields = Object.keys(after ?? {})) {
  const changes = {};
  for (const field of fields) {
    const from = comparable(before?.[field]);
    const to = comparable(after?.[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return Object.keys(changes).length ? changes : null;
}
