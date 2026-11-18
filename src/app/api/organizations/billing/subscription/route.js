import { parseBody } from "@/lib/api";
import { requireBillingAdminApi } from "@/lib/billing/access";
import { PlanChangeError, setSubscriptionAutoRenew } from "@/lib/billing/plan-changes";
import { formatDate } from "@/lib/format";
import { autoRenewSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Идэвхтэй багцын автомат сунгалтыг зогсоох / сэргээх (ORG_ADMIN)
export async function PATCH(request) {
  const { error, session, organization } = await requireBillingAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, autoRenewSchema);
  if (invalid) return invalid;

  try {
    const subscription = await setSubscriptionAutoRenew({ organizationId: organization.id, autoRenew: data.autoRenew });
    await logAudit({
      action: "billing.auto_renew",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "Subscription", id: subscription.id },
      summary: `"${subscription.packageName}" багцын автомат сунгалтыг ${data.autoRenew ? "сэргээв" : "зогсоов"}`,
    });
    return Response.json({
      message: data.autoRenew
        ? "Автомат сунгалт сэргээгдлээ"
        : `Автомат сунгалт зогслоо. Багц ${formatDate(subscription.expiresAt)} хүртэл ашиглагдана.`,
    });
  } catch (err) {
    if (err instanceof PlanChangeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
