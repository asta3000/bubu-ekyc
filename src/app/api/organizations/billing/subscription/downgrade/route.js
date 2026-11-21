import { parseBody } from "@/lib/api";
import { requireBillingAdminApi, requireBillingApi } from "@/lib/billing/access";
import { PlanChangeError, cancelDowngrade, orderDowngrade } from "@/lib/billing/plan-changes";
import { formatDate } from "@/lib/format";
import { planChangeSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Жилийн багцыг хугацаа дуусахад хямд багц руу (жилээр) сунгах захиалга (ORG_ADMIN)
export async function POST(request) {
  const { error, session, organization } = await requireBillingAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, planChangeSchema);
  if (invalid) return invalid;

  try {
    const downgrade = await orderDowngrade({ organizationId: organization.id, packageId: data.packageId });
    const when = formatDate(downgrade.effectiveAt);
    await logAudit({
      action: "billing.downgrade_order",
      actor: session.user,
      organizationId: organization.id,
      summary: `Жилийн хугацаа дуусахад (${when}) "${downgrade.name}" багц руу бууруулах захиалга өгөв`,
      metadata: { packageId: data.packageId },
    });
    return Response.json({ message: `${when}-нд "${downgrade.name}" багц руу жилээр шилжинэ` }, { status: 201 });
  } catch (err) {
    if (err instanceof PlanChangeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// Бууруулах захиалгыг цуцлах (бүх хэрэглэгч)
export async function DELETE() {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;
  try {
    await cancelDowngrade({ organizationId: organization.id });
    await logAudit({
      action: "billing.downgrade_cancel",
      actor: session.user,
      organizationId: organization.id,
      summary: "Багц бууруулах захиалгыг цуцлав",
    });
    return Response.json({ message: "Бууруулах захиалга цуцлагдлаа" });
  } catch (err) {
    if (err instanceof PlanChangeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
