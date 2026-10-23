import { prisma } from "@/lib/prisma";
import { syncQpayPayment } from "@/lib/billing/payments";

// QPay төлбөр төлөгдөхөд дууддаг callback. Нэвтрэлтгүй тул хүсэлтийн агуулгад
// итгэхгүй, QPay-ээс өөрөөс нь (payment/check) шалгаж байж хэрэгжүүлнэ.
export async function GET(request) {
  const paymentId = request.nextUrl.searchParams.get("payment");
  const payment = paymentId ? await prisma.payment.findUnique({ where: { id: paymentId } }) : null;
  if (payment) {
    try {
      await syncQpayPayment(payment);
    } catch (error) {
      console.error(`[qpay] callback ${paymentId}:`, error.message);
    }
  }
  return new Response("SUCCESS");
}

export const POST = GET;
