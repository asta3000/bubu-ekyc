import { completePayment } from "@/lib/billing/payments";
import { requireAdminApi } from "@/lib/session";
import { bankTransferOrError } from "../../shared";

// Банкны шилжүүлэг орж ирснийг админ баталгаажуулна → хэтэвч цэнэглэгдэх / багц идэвхжинэ
export async function POST(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { id } = await ctx.params;
  const { error: notBank } = await bankTransferOrError(id);
  if (notBank) return notBank;
  const done = await completePayment(id, { reviewedById: session.user.id });
  if (!done) return Response.json({ error: "Төлбөр хүлээгдэж буй төлөвт байхгүй байна" }, { status: 409 });
  return Response.json({ ok: true });
}
