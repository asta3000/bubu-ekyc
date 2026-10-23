import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/api";
import { syncQpayPayment } from "@/lib/billing/payments";
import { QpayError } from "@/lib/billing/qpay";
import { requireAdminApi } from "@/lib/session";

// QPay төлбөрийг гараар шалгах (callback ирээгүй үед)
export async function POST(request, ctx) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return notFound("Төлбөр олдсонгүй");
  try {
    const paid = await syncQpayPayment(payment);
    return Response.json({ paid, message: paid ? "Төлбөр төлөгдсөн" : "Төлбөр хараахан төлөгдөөгүй байна" });
  } catch (err) {
    if (err instanceof QpayError) return Response.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
