import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/api";
import { logAudit } from "@/lib/audit/log";
import { PAYMENT_PURPOSES } from "@/lib/billing/labels";
import { formatMoney } from "@/lib/format";

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

// Төлбөрийн шийдвэрийг төлбөрийн байгууллагын аудит логт бүртгэнэ. verb: "баталгаажуулав" г.м.
export async function logPaymentReview(action, id, actor, verb, metadata = null) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { organizationId: true, amount: true, purpose: true, method: true, reference: true },
  });
  if (!payment) return;
  await logAudit({
    action,
    actor,
    organizationId: payment.organizationId,
    entity: { type: "Payment", id },
    summary: `${PAYMENT_PURPOSES[payment.purpose] ?? payment.purpose} ${formatMoney(payment.amount)} (${payment.reference}) төлбөрийг ${verb}`,
    metadata: { method: payment.method, ...metadata },
  });
}
