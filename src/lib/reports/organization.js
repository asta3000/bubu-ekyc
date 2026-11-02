import { prisma } from "@/lib/prisma";
import { BILLABLE_SERVICES } from "@/lib/billing/services";

// Байгууллагын админы тайлангууд (зөвхөн өөрийн байгууллагын)

// Захиалгын төрөл: өмнөх (идэвхжсэн) захиалгатай харьцуулна
function purchaseKind(subscription, previous, autoRenewed) {
  if (autoRenewed) return "AUTO_RENEW";
  if (!previous) return "NEW";
  if (previous.packageId && previous.packageId === subscription.packageId) return "RENEW";
  if (subscription.basePrice > previous.basePrice) return "UPGRADE";
  if (subscription.basePrice < previous.basePrice) return "DOWNGRADE";
  return "CHANGE";
}

export const PURCHASE_KINDS = {
  NEW: { label: "Шинээр авсан", tone: "blue" },
  RENEW: { label: "Сунгасан", tone: "green" },
  AUTO_RENEW: { label: "Автоматаар сунгагдсан", tone: "green" },
  UPGRADE: { label: "Ахиулсан", tone: "blue" },
  DOWNGRADE: { label: "Бууруулсан", tone: "amber" },
  CHANGE: { label: "Сольсон", tone: "gray" },
};

// 1. Багц худалдан авалт, сунгалтын түүх (шинэ нь эхэндээ). Цуцалсан захиалгыг ч харуулна.
export async function subscriptionHistoryReport(organizationId) {
  const subscriptions = await prisma.subscription.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      packageId: true,
      packageName: true,
      basePrice: true,
      durationDays: true,
      status: true,
      startsAt: true,
      expiresAt: true,
      createdAt: true,
      payments: {
        select: { amount: true, method: true, status: true, createdBy: { select: { firstName: true, lastName: true } } },
      },
      redemption: { select: { coupon: { select: { code: true } }, discountAmount: true, extraDays: true } },
    },
  });

  let previous = null;
  const rows = subscriptions.map((subscription) => {
    const payment = subscription.payments.find((item) => item.status === "PAID") ?? subscription.payments[0] ?? null;
    // Автомат сунгалт: хэрэглэгчгүй (систем) хэтэвчээр төлсөн
    const autoRenewed = payment?.method === "WALLET" && payment.status === "PAID" && !payment.createdBy;
    const row = {
      ...subscription,
      kind: purchaseKind(subscription, previous, autoRenewed),
      paid: subscription.payments.filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0),
      method: payment?.method ?? null,
      by: payment?.createdBy ?? null,
      coupon: subscription.redemption?.coupon.code ?? null,
    };
    // Идэвхжсэн захиалга л дараагийнхтай харьцуулах суурь болно
    if (subscription.startsAt) previous = subscription;
    return row;
  });
  const activated = rows.filter((row) => row.startsAt);
  return {
    rows: rows.reverse(),
    totals: {
      count: activated.length,
      renewals: activated.filter((row) => row.kind === "RENEW" || row.kind === "AUTO_RENEW").length,
      paid: rows.reduce((sum, row) => sum + row.paid, 0),
    },
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Огнооны шүүлтүүр (Улаанбаатарын цагаар): { from, to } → Prisma createdAt нөхцөл
export function periodFilter({ from, to }) {
  const start = DATE.test(from ?? "") ? new Date(`${from}T00:00:00+08:00`) : null;
  const end = DATE.test(to ?? "") ? new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000) : null;
  return {
    from: start ? from : "",
    to: end ? to : "",
    where: start || end ? { createdAt: { ...(start && { gte: start }), ...(end && { lt: end }) } } : {},
  };
}

// 2. Хэрэглэгч бүр аль үйлчилгээг хэдэн удаа ашигласан (буцаагдсан ашиглалтыг тооцохгүй).
// Багцын тооноос ба задгай үнээр (хэтэвчнээс) ашигласныг ялгана.
export async function serviceUsageReport(organizationId, period) {
  const groups = await prisma.serviceUsage.groupBy({
    by: ["userId", "service", "charge"],
    where: { organizationId, refundedAt: null, ...period.where },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const userIds = [...new Set(groups.map((row) => row.userId).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true, status: true },
  });

  const byUser = new Map();
  for (const group of groups) {
    const key = group.userId ?? "unknown";
    const row = byUser.get(key) ?? {
      key,
      user: users.find((user) => user.id === group.userId) ?? null,
      services: Object.fromEntries(BILLABLE_SERVICES.map((service) => [service.key, { quota: 0, overage: 0 }])),
      total: 0,
      amount: 0,
    };
    const service = (row.services[group.service] ??= { quota: 0, overage: 0 });
    service[group.charge === "QUOTA" ? "quota" : "overage"] += group._count._all;
    row.total += group._count._all;
    row.amount += group._sum.amount ?? 0;
    byUser.set(key, row);
  }

  const rows = [...byUser.values()].sort((a, b) => b.total - a.total);
  const totals = {
    services: Object.fromEntries(
      BILLABLE_SERVICES.map(({ key }) => [
        key,
        rows.reduce((sum, row) => sum + row.services[key].quota + row.services[key].overage, 0),
      ]),
    ),
    total: rows.reduce((sum, row) => sum + row.total, 0),
    amount: rows.reduce((sum, row) => sum + row.amount, 0),
  };
  return { rows, totals };
}
