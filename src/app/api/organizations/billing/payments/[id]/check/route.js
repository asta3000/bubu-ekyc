import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/api";
import { requireBillingApi } from "@/lib/billing/access";
import { syncQpayPayment } from "@/lib/billing/payments";
import { QpayError } from "@/lib/billing/qpay";

// "Төлбөр шалгах": QPay-ээс төлөгдсөн эсэхийг шалгаж, төлөгдсөн бол хэрэгжүүлнэ
export async function POST(request, ctx) {
  const { error, organization } = await requireBillingApi();
  if (error) return error;

  const { id } = await ctx.params;
  const payment = await prisma.payment.findFirst({ where: { id, organizationId: organization.id } });
  if (!payment) return notFound("Төлбөр олдсонгүй");
  try {
    const paid = await syncQpayPayment(payment);
    return Response.json({ paid, message: paid ? "Төлбөр амжилттай төлөгдлөө" : "Төлбөр хараахан төлөгдөөгүй байна" });
  } catch (err) {
    if (err instanceof QpayError) return Response.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
