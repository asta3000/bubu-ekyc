import { parseBody, notFound } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { DOCUMENT_TYPES, documentAvailable, loadPaymentDocument, sendDocument } from "@/lib/billing/documents";
import { formatMoney } from "@/lib/format";
import { paymentDocumentSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit/log";

// Гүйлгээний нэхэмжлэх эсвэл зарлагын баримтыг (нэг гүйлгээнд нэг л баримт) хүсэлт гаргагч ба
// байгууллагын админууд руу дахин имэйлээр илгээнэ
export async function POST(request, ctx) {
  const { error, session, organization } = await requireBillingApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, paymentDocumentSchema);
  if (invalid) return invalid;
  const { id } = await ctx.params;
  const payment = await loadPaymentDocument(id);
  if (!payment || payment.organizationId !== organization.id) return notFound("Төлбөр олдсонгүй");
  const name = DOCUMENT_TYPES[data.type].name;
  if (!documentAvailable(payment, data.type)) {
    return Response.json({ error: `Энэ гүйлгээнд ${name.toLowerCase()} үүсэхгүй` }, { status: 400 });
  }

  let to;
  try {
    to = await sendDocument(data.type, payment);
  } catch (err) {
    return Response.json({ error: `Имэйл илгээж чадсангүй: ${err.message}` }, { status: 502 });
  }
  if (!to.length) return Response.json({ error: "Илгээх имэйл хаяг олдсонгүй" }, { status: 400 });

  await logAudit({
    action: "billing.document_email",
    actor: session.user,
    organizationId: organization.id,
    entity: { type: "Payment", id: payment.id },
    summary: `${name} № ${payment.reference} (${formatMoney(payment.amount)})-ийг имэйлээр илгээв`,
    metadata: { type: data.type, to },
  });
  return Response.json({ message: `${name} ${to.join(", ")} хаяг руу илгээгдлээ` });
}
