import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, ORG_VISIBLE_ACTIONS } from "./actions";

export const AUDIT_PAGE_SIZE = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = (value) => (Array.isArray(value) ? value[0] : value) ?? "";

// URL-ийн searchParams-аас шүүлтүүр: { q, category, action, status, organizationId, from, to, page }
export function auditFilters(params = {}) {
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).trim().slice(0, 100),
    category: AUDIT_CATEGORIES[one(params.category)] ? one(params.category) : "",
    action: one(params.action).slice(0, 100),
    status: ["SUCCESS", "FAILURE"].includes(one(params.status)) ? one(params.status) : "",
    organizationId: one(params.organizationId).slice(0, 50),
    from: DATE.test(one(params.from)) ? one(params.from) : "",
    to: DATE.test(one(params.to)) ? one(params.to) : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

// Огноог Улаанбаатарын цагаар өдрийн эхлэл/төгсгөл болгоно
const dayStart = (date) => new Date(`${date}T00:00:00+08:00`);
const dayEnd = (date) => new Date(dayStart(date).getTime() + 24 * 60 * 60 * 1000);

// Аудит логийг шүүж хуудаслана. organizationId өгвөл (байгууллагын админ) зөвхөн тухайн
// байгууллагын, байгууллагад харагдах үйлдлүүдийг. Буцаах: { logs, total, page, pages }
export async function queryAuditLogs(filters, { organizationId = null } = {}) {
  const where = {
    ...(organizationId
      ? { organizationId, action: { in: ORG_VISIBLE_ACTIONS } }
      : filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.category && { category: filters.category }),
    ...(filters.status && { status: filters.status }),
    ...((filters.from || filters.to) && {
      createdAt: { ...(filters.from && { gte: dayStart(filters.from) }), ...(filters.to && { lt: dayEnd(filters.to) }) },
    }),
    ...(filters.q && {
      OR: ["actorEmail", "actorName", "summary", ...(organizationId ? [] : ["ip", "entityId"])].map((field) => ({
        [field]: { contains: filters.q, mode: "insensitive" },
      })),
    }),
  };
  // Байгууллагын шүүлтүүр (in) ба сонгосон үйлдлийг нэгтгэнэ
  if (filters.action) {
    where.action = organizationId && !ORG_VISIBLE_ACTIONS.includes(filters.action) ? { in: [] } : filters.action;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
  ]);
  return { logs, total, page: filters.page, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

// Шүүлтүүрийн сонголтууд. orgView бол байгууллагад харагдах үйлдлүүд л.
export function auditOptions(orgView) {
  const actions = Object.entries(AUDIT_ACTIONS).filter(([, action]) => !orgView || action.org);
  const categories = new Set(actions.map(([key]) => key.split(".")[0]));
  return {
    categories: Object.entries(AUDIT_CATEGORIES)
      .filter(([key]) => categories.has(key))
      .map(([value, label]) => ({ value, label })),
    actions: actions.map(([value, { label }]) => ({ value, label })),
  };
}
