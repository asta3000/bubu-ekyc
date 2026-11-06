import { confirmBankPayment } from "@/lib/billing/payments";
import { requireAdminApi } from "@/lib/session";
import { bankTransferOrError, logPaymentReview } from "../../shared";

// Банкны шилжүүлэг орж ирснийг админ баталгаажуулна → хэтэвч цэнэглэгдэх / багц идэвхжинэ
export async function POST(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  const { error: notBank } = await bankTransferOrError(id);
  if (notBank) return notBank;
  const done = await confirmBankPayment(id, { reviewedById: session.user.id });
  if (!done) return Response.json({ error: "Төлбөр хүлээгдэж буй төлөвт байхгүй байна" }, { status: 409 });
  await logPaymentReview("payment.confirm", id, session.user, "баталгаажуулав");
  return Response.json({ ok: true });
}
