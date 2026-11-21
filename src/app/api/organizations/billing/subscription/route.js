import { parseBody } from "@/lib/api";
import { adminOnlyError, requireBillingApi } from "@/lib/billing/access";
import { PlanChangeError, setSubscriptionAutoRenew } from "@/lib/billing/plan-changes";
import { formatDate } from "@/lib/format";
import { autoRenewSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Идэвхтэй багцын автомат сунгалтыг зогсоох (ORG_ADMIN) / сэргээх (бүх хэрэглэгч)
export async function PATCH(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, autoRenewSchema);
  if (invalid) return invalid;
  const denied = adminOnlyError(session, !data.autoRenew);
  if (denied) return denied;

  try {
    const { subscription, cancelledUpgrade } = await setSubscriptionAutoRenew({
      organizationId: organization.id,
      autoRenew: data.autoRenew,
      userId: session.user.id,
    });
    await logAudit({
      action: "billing.auto_renew",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "Subscription", id: subscription.id },
      summary: `"${subscription.packageName}" багцын автомат сунгалтыг ${data.autoRenew ? "сэргээв" : "зогсоов"}${
        cancelledUpgrade ? " (сунгалтаар хэрэгжих ахиулах захиалга цуцлагдаж барьсан дүн буцав)" : ""
      }`,
    });
    return Response.json({
      message: data.autoRenew
        ? "Автомат сунгалт сэргээгдлээ"
        : `Автомат сунгалт зогслоо. Багц ${formatDate(subscription.expiresAt)} хүртэл ашиглагдана.${
            cancelledUpgrade ? " Ахиулах захиалга цуцлагдаж, барьсан дүн хэтэвчинд буцлаа." : ""
          }`,
    });
  } catch (err) {
    if (err instanceof PlanChangeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
