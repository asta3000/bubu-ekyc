import { after } from "next/server";
import { fieldError, parseBody } from "@/lib/api";
import { sendTopupInvoice } from "@/lib/billing/documents";
import { requireBillingApi } from "@/lib/billing/access";
import { PAYMENT_METHODS } from "@/lib/billing/labels";
import { PaymentError, createTopup, minTopupAmount } from "@/lib/billing/payments";
import { isQpayConfigured } from "@/lib/billing/qpay";
import { formatMoney } from "@/lib/format";
import { topupSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Хэтэвч цэнэглэх төлбөр үүсгэнэ (QPay нэхэмжлэх эсвэл банкны шилжүүлгийн утга)
export async function POST(request) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, topupSchema);
  if (invalid) return invalid;
  const minimum = await minTopupAmount();
  if (data.amount < minimum) {
    return fieldError("amount", `Цэнэглэх доод дүн ${formatMoney(minimum)} (хамгийн хямд багцын үнэ)`);
  }
  if (data.method === "QPAY" && !isQpayConfigured()) {
    return Response.json({ error: "QPay тохируулаагүй байна. Банкны шилжүүлгээр төлнө үү." }, { status: 503 });
  }

  try {
    const payment = await createTopup({ organizationId: organization.id, userId: session.user.id, ...data });
    await logAudit({
      action: "billing.topup",
      actor: session.user,
      organizationId: organization.id,
      entity: { type: "Payment", id: payment.id },
      summary: `Хэтэвч ${formatMoney(data.amount)}-өөр цэнэглэх төлбөр үүсгэв (${PAYMENT_METHODS[data.method]})`,
      metadata: { method: data.method, reference: payment.reference },
    });
    // Нэхэмжлэхийг хэрэглэгч ба байгууллагын админууд руу хариуг хүлээлгэлгүй илгээнэ
    after(() => sendTopupInvoice(payment.id));
    return Response.json({ paymentId: payment.id }, { status: 201 });
  } catch (err) {
    if (err instanceof PaymentError) return Response.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
