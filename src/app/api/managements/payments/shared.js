import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/api";

// Админ зөвхөн банкны шилжүүлгийг гараар баталгаажуулна/татгалзана. QPay-г
// QPay-ээс өөрөөс нь шалгаж (check) хэрэгжүүлнэ.
export async function bankTransferOrError(id) {
  const payment = await prisma.payment.findUnique({ where: { id }, select: { method: true } });
  if (!payment) return { error: notFound("Төлбөр олдсонгүй") };
  if (payment.method !== "BANK_TRANSFER") {
    return { error: Response.json({ error: "Зөвхөн банкны шилжүүлгийг гараар шийдвэрлэнэ" }, { status: 400 }) };
  }
  return {};
}
