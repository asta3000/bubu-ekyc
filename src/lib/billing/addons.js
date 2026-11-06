import { prisma } from "@/lib/prisma";
import { ADDON_SOURCE_KEYS, CORE_SOURCES, SANCTION_SOURCE_KEYS, sanctionSource } from "@/lib/sanctions/sources";
import { renewDue, retireOlderAddons } from "./renewals";
import { activeSubscription } from "./subscriptions";
import { changeBalance, lockWallet } from "./wallet";

const DAY_MS = 24 * 60 * 60 * 1000;

export class AddonError extends Error {}

// Байгууллагын хугацаа нь дуусаагүй нэмэлт жагсаалтууд: Map(source → дуусах огноо)
export async function activeAddons(organizationId, db = prisma) {
  const rows = await db.organizationAddon.groupBy({
    by: ["source"],
    where: { organizationId, expiresAt: { gt: new Date() } },
    _max: { expiresAt: true },
  });
  return new Map(rows.map((row) => [row.source, row._max.expiresAt]));
}

// Тулгалтад ашиглаж болох жагсаалтууд: системийн админ бүгдийг, байгууллага үндсэн
// жагсаалтууд дээр идэвхтэй нэмэлт жагсаалтаа. Өөрийн жагсаалтыг (CUSTOM) API өөрөө шийднэ.
export async function allowedSources(session, organization) {
  if (session.user.role === "ADMIN") return new Set(SANCTION_SOURCE_KEYS);
  // Хугацаа нь дууссан, автомат сунгалттай нэмэлт жагсаалтыг эхлээд сунгана
  await renewDue(organization.id);
  const addons = await activeAddons(organization.id);
  return new Set([...CORE_SOURCES.map((source) => source.key), ...addons.keys()]);
}

// Сонгосон жагсаалтуудаас идэвхжүүлээгүй нэмэлт жагсаалт байвал алдааны мессеж
export function lockedSourcesError(sources, allowed) {
  const locked = sources.filter((source) => source !== "CUSTOM" && !allowed.has(source));
  if (!locked.length) return null;
  const names = locked.map((source) => sanctionSource(source)?.name ?? source).join(", ");
  return `${names} нэмэлт жагсаалт идэвхжээгүй байна. "Багц, төлбөр" хэсгээс идэвхжүүлнэ үү.`;
}

// Нэмэлт жагсаалтыг хэтэвчнээс худалдаж авна. Идэвхтэй багцтай байх шаардлагатай.
// Хугацаа нь дуусаагүй бол дуусах өдрөөс нь сунгана. Автомат сунгалт асаалттай болно.
export async function purchaseAddon({ organizationId, userId, source }) {
  if (!ADDON_SOURCE_KEYS.includes(source)) throw new AddonError("Нэмэлт жагсаалт олдсонгүй");
  const addon = await prisma.sourceAddon.findFirst({ where: { source, status: "ACTIVE" } });
  if (!addon) throw new AddonError("Энэ нэмэлт жагсаалтыг одоогоор худалдаалахгүй байна");

  return prisma.$transaction(async (tx) => {
    // Зэрэг худалдан авалт хугацааг давхар тооцохоос сэргийлнэ
    await lockWallet(tx, organizationId);
    if (!(await activeSubscription(organizationId, tx))) {
      throw new AddonError("Нэмэлт жагсаалт авахын тулд эхлээд үндсэн багц идэвхжүүлнэ үү");
    }

    const now = new Date();
    const current = (await activeAddons(organizationId, tx)).get(source);
    const startsAt = current && current > now ? current : now;
    const created = await tx.organizationAddon.create({
      data: {
        organizationId,
        source,
        price: addon.price,
        startsAt,
        expiresAt: new Date(startsAt.getTime() + addon.durationDays * DAY_MS),
        createdById: userId,
      },
    });
    await retireOlderAddons(tx, created);
    if (addon.price > 0) {
      await changeBalance(tx, {
        organizationId,
        amount: -addon.price,
        type: "ADDON_PURCHASE",
        description: `${sanctionSource(source).name} (${addon.durationDays} хоног)`,
        userId,
      });
    }
    return { ...created, durationDays: addon.durationDays };
  });
}

// Нэмэлт жагсаалтын автомат сунгалтыг зогсоох (false) эсвэл сэргээх (true). Өмнө нь
// авч байгаагүй бол AddonError. Буцаах: хамгийн сүүлийн хугацааны мөр
export async function setAddonAutoRenew({ organizationId, source, autoRenew }) {
  const latest = await prisma.organizationAddon.findFirst({
    where: { organizationId, source },
    orderBy: { expiresAt: "desc" },
  });
  if (!latest) throw new AddonError("Энэ нэмэлт жагсаалтыг авч байгаагүй байна");
  return prisma.organizationAddon.update({ where: { id: latest.id }, data: { autoRenew } });
}
