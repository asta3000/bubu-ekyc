import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit/log";
import { formatDate, formatMoney } from "@/lib/format";
import { annualPlanSettings } from "./annual-plan";
import { LOCKED_TRANSACTION, uniqueReference } from "./payments";
import { annualPeriod, annualTerms, upgradeQuote } from "./services";
import { activeSubscription, cancelPendingUpgrades, contractBlocks } from "./subscriptions";
import { InsufficientFundsError, consumeHeldFunds, holdFunds, lockWallet } from "./wallet";

// Идэвхтэй багцын автомат сунгалт, жилийн багцын сар солигдох (тоо шинэчлэх), ахиулах,
// бууруулах захиалга.
//   Ахиулах: жилийн багцыг илүү үнэтэй багц руу. Үлдсэн сарын үнийн зөрүүг хэтэвчнээс барьж,
//            одоогийн сар дуусахад хэрэгжүүлнэ. Сүүлийн сард боломжгүй.
//   Бууруулах: жилийн хугацаа дуусахад хямд багц руу жилээр сунгана (nextPackageId).
// Нэг удаад нэг л захиалга (ахиулах эсвэл бууруулах) хүлээгдэнэ.

export class PlanChangeError extends Error {}

const packageWithItems = (db, id) =>
  db.package.findFirst({ where: { id, status: "ACTIVE" }, include: { items: true } });

const pendingUpgrade = (db, subscriptionId) =>
  db.packageUpgrade.findFirst({ where: { subscriptionId, status: "PENDING" }, include: { package: { select: { name: true } } } });

// ---- Жилийн багцын сар солигдох ----

// Жилийн багцын сар дууссан бол: хүлээгдэж буй ахиулах захиалгыг хэрэгжүүлж, үйлчилгээний
// тоог шинэчилнэ (ашиглаагүй тоо шилжихгүй). Хугацаа нь дууссан багцыг renewExpiredSubscription
// шийднэ. Буцаах: { rolled, upgraded } эсвэл null
export async function rollAnnualPeriod(organizationId) {
  const now = new Date();
  const candidate = await prisma.subscription.findFirst({
    where: { organizationId, status: "ACTIVE", annual: true, expiresAt: { gt: now } },
    select: { id: true, startsAt: true, expiresAt: true, durationDays: true, periodDays: true, periodStartsAt: true, annual: true },
  });
  const period = annualPeriod(candidate, now);
  if (!period || (candidate.periodStartsAt && candidate.periodStartsAt >= period.start)) return null;

  const result = await prisma.$transaction(async (tx) => {
    await lockWallet(tx, organizationId);
    const subscription = await tx.subscription.findUnique({ where: { id: candidate.id } });
    // Зэрэг ирсэн хүсэлт аль хэдийн шилжүүлсэн байж болно
    if (subscription.status !== "ACTIVE" || (subscription.periodStartsAt && subscription.periodStartsAt >= period.start)) {
      return null;
    }

    let upgraded = null;
    const upgrade = await tx.packageUpgrade.findFirst({
      where: { subscriptionId: subscription.id, status: "PENDING", effectiveAt: { lte: now } },
    });
    if (upgrade) {
      const pkg = await tx.package.findUnique({ where: { id: upgrade.packageId }, include: { items: true } });
      await tx.subscriptionItem.deleteMany({ where: { subscriptionId: subscription.id } });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          packageId: pkg.id,
          packageName: pkg.name,
          // Дараагийн сунгалт ахисан багцын жилийн үнээр
          basePrice: upgrade.annualPrice,
          periodDays: pkg.durationDays ?? subscription.periodDays,
          items: { create: pkg.items.map(({ service, quota, unitPrice }) => ({ service, quota, unitPrice })) },
        },
      });
      await consumeHeldFunds(tx, { organizationId, amount: upgrade.amount });
      if (upgrade.amount > 0) {
        await tx.payment.create({
          data: {
            organizationId,
            createdById: upgrade.createdById,
            purpose: "PACKAGE_PURCHASE",
            method: "WALLET",
            status: "PAID",
            amount: upgrade.amount,
            subscriptionId: subscription.id,
            reference: await uniqueReference(),
            paidAt: now,
          },
        });
      }
      await tx.packageUpgrade.update({ where: { id: upgrade.id }, data: { status: "APPLIED", appliedAt: now } });
      upgraded = { from: subscription.packageName, to: pkg.name, amount: upgrade.amount, subscriptionId: subscription.id };
    } else {
      // Шинэ сард тоо шинээр эхэлнэ
      await tx.subscriptionItem.updateMany({ where: { subscriptionId: subscription.id }, data: { used: 0 } });
    }
    await tx.subscription.update({ where: { id: subscription.id }, data: { periodStartsAt: period.start } });
    return { rolled: true, upgraded };
  }, LOCKED_TRANSACTION);

  if (result?.upgraded) {
    const { from, to, amount, subscriptionId } = result.upgraded;
    await logAudit({
      action: "billing.upgrade_applied",
      organizationId,
      entity: { type: "Subscription", id: subscriptionId },
      summary: `"${from}" багцыг "${to}" болгон ахиулав (барьсан ${formatMoney(amount)})`,
    });
  }
  return result;
}

// ---- Автомат сунгалт ----

// Зогсоовол хүлээгдэж буй бууруулах захиалга цуцлагдана (бууруулах нь сунгалт тул)
export async function setSubscriptionAutoRenew({ organizationId, autoRenew }) {
  const subscription = await activeSubscription(organizationId);
  if (!subscription) throw new PlanChangeError("Идэвхтэй багц байхгүй байна");
  if (!subscription.expiresAt) throw new PlanChangeError("Хугацаагүй багц сунгагдахгүй");
  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { autoRenew, ...(!autoRenew && { nextPackageId: null }) },
  });
}

// ---- Ахиулах, бууруулах боломжтой багцууд ----

// Жилийн багцаас ахиулах (илүү үнэтэй), бууруулах (хямд) боломжтой багцууд.
// Буцаах: { upgrades: [{ id, name, annualPrice, amount, effectiveAt, months }], downgrades: [{ id, name, annualPrice }] }
export async function planChangeOptions(organizationId, subscription) {
  if (!subscription?.annual) return { upgrades: [], downgrades: [] };
  const [settings, organization, packages] = await Promise.all([
    annualPlanSettings(),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { contractSigned: true } }),
    prisma.package.findMany({
      where: { status: "ACTIVE", id: { not: subscription.packageId ?? "" } },
      orderBy: { basePrice: "asc" },
      select: { id: true, name: true, basePrice: true, durationDays: true, contractRequired: true },
    }),
  ]);
  const upgrades = [];
  const downgrades = [];
  for (const pkg of packages) {
    const terms = annualTerms(pkg, settings);
    if (!terms || contractBlocks(pkg, organization)) continue;
    if (terms.price > subscription.basePrice) {
      const quote = upgradeQuote(subscription, terms.price);
      if (quote) upgrades.push({ id: pkg.id, name: pkg.name, annualPrice: terms.price, ...quote });
    } else if (terms.price < subscription.basePrice) {
      downgrades.push({ id: pkg.id, name: pkg.name, annualPrice: terms.price });
    }
  }
  return { upgrades, downgrades };
}

async function annualSubscriptionOrError(organizationId) {
  const subscription = await activeSubscription(organizationId);
  if (!subscription?.annual) throw new PlanChangeError("Зөвхөн жилээр авсан багцыг ахиулах, бууруулах боломжтой");
  return subscription;
}

// ---- Ахиулах ----

export async function orderUpgrade({ organizationId, userId, packageId }) {
  const subscription = await annualSubscriptionOrError(organizationId);
  const option = (await planChangeOptions(organizationId, subscription)).upgrades.find((item) => item.id === packageId);
  if (!option) throw new PlanChangeError("Энэ багц руу ахиулах боломжгүй");

  return prisma.$transaction(async (tx) => {
    await lockWallet(tx, organizationId);
    const current = await tx.subscription.findUnique({ where: { id: subscription.id } });
    if (current.status !== "ACTIVE") throw new PlanChangeError("Идэвхтэй багц байхгүй байна");
    if (await pendingUpgrade(tx, current.id)) throw new PlanChangeError("Ахиулах захиалга аль хэдийн байна");
    if (current.nextPackageId) throw new PlanChangeError("Бууруулах захиалга байна. Эхлээд түүнийг цуцална уу.");
    try {
      await holdFunds(tx, {
        organizationId,
        amount: option.amount,
        description: `"${option.name}" багц руу ахиулах захиалга (${formatDate(option.effectiveAt)}-нд хэрэгжинэ)`,
        userId,
      });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw new PlanChangeError(`Хэтэвчний үлдэгдэл хүрэлцэхгүй байна. Ахиулахад ${formatMoney(option.amount)} шаардлагатай.`);
      }
      throw error;
    }
    return tx.packageUpgrade.create({
      data: {
        organizationId,
        subscriptionId: current.id,
        packageId,
        annualPrice: option.annualPrice,
        amount: option.amount,
        effectiveAt: option.effectiveAt,
        createdById: userId,
      },
      include: { package: { select: { name: true } } },
    });
  }, LOCKED_TRANSACTION);
}

export async function cancelUpgrade({ organizationId, userId }) {
  const subscription = await activeSubscription(organizationId);
  if (!subscription) throw new PlanChangeError("Идэвхтэй багц байхгүй байна");
  const count = await prisma.$transaction(async (tx) => {
    await lockWallet(tx, organizationId);
    return cancelPendingUpgrades(tx, organizationId, "Багц ахиулах захиалгыг цуцалж барьсныг буцаав", {
      userId,
      subscriptionId: subscription.id,
    });
  }, LOCKED_TRANSACTION);
  if (!count) throw new PlanChangeError("Ахиулах захиалга байхгүй байна");
  return count;
}

// ---- Бууруулах ----

// Жилийн хугацаа дуусахад хямд багц руу жилээр сунгана. Сунгалт тул автомат сунгалтыг асаана.
export async function orderDowngrade({ organizationId, packageId }) {
  const subscription = await annualSubscriptionOrError(organizationId);
  if (await pendingUpgrade(prisma, subscription.id)) {
    throw new PlanChangeError("Ахиулах захиалга байна. Эхлээд түүнийг цуцална уу.");
  }
  const option = (await planChangeOptions(organizationId, subscription)).downgrades.find((item) => item.id === packageId);
  if (!option) throw new PlanChangeError("Энэ багц руу бууруулах боломжгүй");
  await prisma.subscription.update({ where: { id: subscription.id }, data: { nextPackageId: packageId, autoRenew: true } });
  return { ...option, effectiveAt: subscription.expiresAt };
}

export async function cancelDowngrade({ organizationId }) {
  const subscription = await activeSubscription(organizationId);
  if (!subscription?.nextPackageId) throw new PlanChangeError("Бууруулах захиалга байхгүй байна");
  await prisma.subscription.update({ where: { id: subscription.id }, data: { nextPackageId: null } });
}

// Хуудсанд: идэвхтэй багцын хүлээгдэж буй захиалгууд
export async function pendingPlanChanges(subscription) {
  if (!subscription) return { upgrade: null, downgrade: null };
  const [upgrade, next] = await Promise.all([
    pendingUpgrade(prisma, subscription.id),
    subscription.nextPackageId ? packageWithItems(prisma, subscription.nextPackageId) : null,
  ]);
  return {
    upgrade: upgrade && { packageName: upgrade.package.name, amount: upgrade.amount, effectiveAt: upgrade.effectiveAt },
    downgrade: next && { packageName: next.name, effectiveAt: subscription.expiresAt },
  };
}
