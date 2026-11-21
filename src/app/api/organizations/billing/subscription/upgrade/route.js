import { parseBody } from "@/lib/api";
import { requireBillingAdminApi, requireBillingApi } from "@/lib/billing/access";
import { PlanChangeError, cancelUpgrade, orderUpgrade } from "@/lib/billing/plan-changes";
import { formatDate, formatMoney } from "@/lib/format";
import { planChangeSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Жилийн багцыг илүү үнэтэй багц руу ахиулах захиалга: үлдсэн сарын зөрүүг хэтэвчнээс барьж,
// одоогийн сар дуусахад хэрэгжүүлнэ. Сүүлийн сард (автомат сунгалттай бол) ахисан багцын жилийн
// үнийг барьж, сунгалтаар хэрэгжүүлнэ (бүх хэрэглэгч)
export async function POST(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, planChangeSchema);
  if (invalid) return invalid;

  try {
    const upgrade = await orderUpgrade({ organizationId: organization.id, userId: session.user.id, packageId: data.packageId });
    const when = formatDate(upgrade.effectiveAt);
    await logAudit({
      action: "billing.upgrade_order",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "PackageUpgrade", id: upgrade.id },
      summary: upgrade.renewal
        ? `Жилийн хугацаа дуусахад "${upgrade.package.name}" багцаар жилээр сунгах (ахиулах) захиалга өгч ${formatMoney(upgrade.amount)} барив (${when}-нд хэрэгжинэ)`
        : `"${upgrade.package.name}" багц руу ахиулах захиалга өгч ${formatMoney(upgrade.amount)} барив (${when}-нд хэрэгжинэ)`,
      metadata: { packageId: data.packageId, amount: upgrade.amount, effectiveAt: upgrade.effectiveAt, renewal: upgrade.renewal },
    });
    return Response.json(
      {
        message: upgrade.renewal
          ? `${when}-нд багц сунгагдахдаа "${upgrade.package.name}" багц руу жилээр ахина. ${formatMoney(upgrade.amount)} хэтэвчнээс барьлаа.`
          : `"${upgrade.package.name}" багц руу ${when}-нд ахина. ${formatMoney(upgrade.amount)} хэтэвчнээс барьлаа.`,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PlanChangeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// Ахиулах захиалгыг цуцалж барьсан дүнг хэтэвчинд буцаана (ORG_ADMIN)
export async function DELETE() {
  const { error, session, organization } = await requireBillingAdminApi();
  if (error) return error;
  try {
    await cancelUpgrade({ organizationId: organization.id, userId: session.user.id });
    await logAudit({
      action: "billing.upgrade_cancel",
      actor: session.user,
      organizationId: organization.id,
      summary: "Багц ахиулах захиалгыг цуцалж барьсан дүнг буцаав",
    });
    return Response.json({ message: "Ахиулах захиалга цуцлагдаж, барьсан дүн хэтэвчинд буцлаа" });
  } catch (err) {
    if (err instanceof PlanChangeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
