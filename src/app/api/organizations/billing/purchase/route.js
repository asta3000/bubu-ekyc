import { fieldError, parseBody } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { CouponError } from "@/lib/billing/coupons";
import { PAYMENT_METHODS } from "@/lib/billing/labels";
import { PaymentError, purchasePackage } from "@/lib/billing/payments";
import { isQpayConfigured } from "@/lib/billing/qpay";
import { InsufficientFundsError } from "@/lib/billing/wallet";
import { purchaseSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Багц худалдаж авах (купонтой байж болно). Хэтэвч / төлөх дүн 0 бол шууд идэвхжинэ,
// бусад үед төлбөр хүлээнэ.
export async function POST(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, purchaseSchema);
  if (invalid) return invalid;
  if (data.method === "QPAY" && !isQpayConfigured()) {
    return Response.json({ error: "QPay тохируулаагүй байна. Өөр аргаар төлнө үү." }, { status: 503 });
  }

  try {
    const { subscription, payment } = await purchasePackage({
      organizationId: organization.id,
      userId: session.user.id,
      ...data,
    });
    await logAudit({
      action: "billing.purchase",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "Subscription", id: subscription.id },
      summary:
        `"${subscription.packageName}" багц ` +
        (subscription.status === "ACTIVE" ? "идэвхжүүлэв" : `авахаар төлбөр үүсгэв (${PAYMENT_METHODS[data.method]})`),
      metadata: { method: data.method, couponCode: data.couponCode, paymentId: payment?.id ?? null },
    });
    return Response.json(
      { active: subscription.status === "ACTIVE", paymentId: payment?.status === "PENDING" ? payment.id : null },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof CouponError) return fieldError("couponCode", err.message);
    if (err instanceof InsufficientFundsError) return Response.json({ error: err.message }, { status: 402 });
    if (err instanceof PaymentError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
