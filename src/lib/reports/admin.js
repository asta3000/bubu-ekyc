import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/api";

// Системийн админы тайлангууд. Устгагдсан байгууллага, хэрэглэгчийг тооцохгүй.

const DAY = 24 * 60 * 60 * 1000;

// Одоо хүчинтэй захиалга (activeSubscription-тэй ижил нөхцөл)
const activeNow = () => ({
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

// 1. Багц бүр дээр одоо хэдэн байгууллага байгаа. Устгагдсан багцын захиалга нэрээрээ,
// идэвхтэй багцгүй байгууллагууд тусдаа мөр болно.
// Буцаах: { rows: [{ key, name, basePrice, durationDays, status, organizations: [name] }], withoutPackage: [name], total }
export async function packageOrganizationsReport() {
  const [packages, subscriptions, organizations] = await Promise.all([
    prisma.package.findMany({
      where: notDeleted,
      orderBy: [{ basePrice: "asc" }, { name: "asc" }],
      select: { id: true, name: true, basePrice: true, durationDays: true, status: true },
    }),
    prisma.subscription.findMany({
      where: { ...activeNow(), organization: notDeleted },
      select: { packageId: true, packageName: true, organizationId: true },
    }),
    prisma.organization.findMany({ where: notDeleted, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const names = new Map(organizations.map((org) => [org.id, org.name]));

  const rows = packages.map((pkg) => ({ key: pkg.id, ...pkg, organizations: [] }));
  for (const subscription of subscriptions) {
    let row = rows.find((item) => item.id === subscription.packageId);
    if (!row) {
      // Багц устгагдсан ч захиалга нь хүчинтэй
      row = rows.find((item) => !item.id && item.name === subscription.packageName);
      if (!row) {
        row = { key: `deleted:${subscription.packageName}`, name: subscription.packageName, status: "DELETED", organizations: [] };
        rows.push(row);
      }
    }
    row.organizations.push(names.get(subscription.organizationId));
  }
  const subscribed = new Set(subscriptions.map((item) => item.organizationId));
  return {
    rows: rows.map((row) => ({ ...row, organizations: row.organizations.sort((a, b) => a.localeCompare(b, "mn")) })),
    withoutPackage: organizations.filter((org) => !subscribed.has(org.id)).map((org) => org.name),
    total: organizations.length,
  };
}

// 2. Байгууллага бүрийн хэрэглэгч: нийт, идэвхтэй, идэвхгүй, сүүлийн 30 хоногт бүртгүүлсэн.
// Системийн ADMIN эрхтэй хэрэглэгчийг тооцохгүй.
export async function organizationUsersReport() {
  const since = new Date(Date.now() - 30 * DAY);
  const userWhere = { organizationId: { not: null }, role: { not: "ADMIN" }, ...notDeleted };
  const [organizations, byStatus, recent] = await Promise.all([
    prisma.organization.findMany({
      where: notDeleted,
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerNumber: true, contractSigned: true, status: true },
    }),
    prisma.user.groupBy({ by: ["organizationId", "status"], where: userWhere, _count: { _all: true } }),
    prisma.user.groupBy({ by: ["organizationId"], where: { ...userWhere, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const count = (organizationId, status) =>
    byStatus.find((row) => row.organizationId === organizationId && row.status === status)?._count._all ?? 0;

  const rows = organizations.map((org) => {
    const active = count(org.id, "ACTIVE");
    const inactive = count(org.id, "INACTIVE");
    return {
      ...org,
      total: active + inactive,
      active,
      inactive,
      recent: recent.find((row) => row.organizationId === org.id)?._count._all ?? 0,
    };
  });
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  return { rows, since, totals: { total: sum("total"), active: sum("active"), inactive: sum("inactive"), recent: sum("recent") } };
}

// 3. Байгууллага бүрийн промо кодыг ашиглаж бүртгүүлсэн байгууллагын тоо (ба авсан урамшуулал),
// мөн промо код ашигласан / ашиглаагүй байгууллагын тоо.
export async function promoUsageReport() {
  const [organizations, rewards] = await Promise.all([
    prisma.organization.findMany({
      where: notDeleted,
      select: {
        id: true,
        name: true,
        referralPromoId: true,
        promos: { orderBy: { createdAt: "desc" }, select: { code: true, discount: true } },
      },
    }),
    prisma.referralReward.groupBy({ by: ["referrerId"], _sum: { amount: true } }),
  ]);
  // Промо кодын эзэн байгууллага бүрээр ашигласан (устгагдаагүй) байгууллагын тоо
  const promoOwners = await prisma.promo.findMany({
    where: { id: { in: organizations.map((org) => org.referralPromoId).filter(Boolean) } },
    select: { id: true, organizationId: true },
  });
  const ownerOf = new Map(promoOwners.map((promo) => [promo.id, promo.organizationId]));
  const referred = new Map();
  for (const org of organizations) {
    const owner = ownerOf.get(org.referralPromoId);
    if (owner) referred.set(owner, [...(referred.get(owner) ?? []), org.name]);
  }

  const rows = organizations
    .map((org) => ({
      id: org.id,
      name: org.name,
      codes: org.promos.map((promo) => promo.code),
      rate: org.promos[0]?.discount ?? null,
      referred: (referred.get(org.id) ?? []).sort((a, b) => a.localeCompare(b, "mn")),
      earned: rewards.find((row) => row.referrerId === org.id)?._sum.amount ?? 0,
    }))
    .sort((a, b) => b.referred.length - a.referred.length || a.name.localeCompare(b.name, "mn"));

  const usedPromo = organizations.filter((org) => org.referralPromoId).length;
  return { rows, usedPromo, withoutPromo: organizations.length - usedPromo, total: organizations.length };
}
