import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { closePayment } from "@/lib/billing/payments";
import { QpayError } from "@/lib/billing/qpay";

// Хүлээгдэж буй төлбөрөө байгууллага цуцална. QPay-ээр аль хэдийн төлсөн байвал
// цуцлахын оронд хэрэгжүүлнэ.
export async function POST(request, ctx) {
  const { error, organization } = await requireBillingApi();
  if (error) return error;

  const { id } = await ctx.params;
  const payment = await prisma.payment.findFirst({ where: { id, organizationId: organization.id }, select: { id: true } });
  if (!payment) return notFound("Төлбөр олдсонгүй");

  let result;
  try {
    result = await closePayment(id, { status: "CANCELLED" });
  } catch (err) {
    if (err instanceof QpayError) return Response.json({ error: `Цуцлах боломжгүй: ${err.message}` }, { status: 502 });
    throw err;
  }
  if (!result) return Response.json({ error: "Төлбөрийг цуцлах боломжгүй" }, { status: 409 });
  return Response.json({
    paid: result === "PAID",
    message: result === "PAID" ? "Төлбөр аль хэдийн төлөгдсөн тул цуцлаагүй, хэрэгжүүллээ" : "Төлбөрийг цуцаллаа",
  });
}
