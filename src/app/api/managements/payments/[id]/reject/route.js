import { parseBody } from "@/lib/api";
import { closePayment } from "@/lib/billing/payments";
import { QpayError } from "@/lib/billing/qpay";
import { requireAdminApi } from "@/lib/session";
import { paymentReviewSchema } from "@/lib/validations";

// Хүлээгдэж буй төлбөрийг татгалзана (банкны шилжүүлэг орж ирээгүй, QPay-ээр төлөөгүй).
// Холбогдох багцын захиалга цуцлагдаж, купон чөлөөлөгдөнө. QPay-ээр аль хэдийн төлсөн
// байвал татгалзахын оронд хэрэгжүүлнэ. QPay-ээс шалгаж чадахгүй бол force-оор л хаана.
export async function POST(request, ctx) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  const { data, error: invalid } = await parseBody(request, paymentReviewSchema);
  if (invalid) return invalid;

  const { id } = await ctx.params;
  let result;
  try {
    result = await closePayment(id, {
      status: "REJECTED",
      reviewedById: session.user.id,
      adminNote: data.adminNote,
      force: data.force,
    });
  } catch (err) {
    if (!(err instanceof QpayError)) throw err;
    return Response.json(
      { error: `QPay-ээс шалгаж чадсангүй: ${err.message}`, code: "QPAY_UNAVAILABLE" },
      { status: 502 },
    );
  }
  if (!result) return Response.json({ error: "Төлбөр хүлээгдэж буй төлөвт байхгүй байна" }, { status: 409 });
  return Response.json({
    paid: result === "PAID",
    message: result === "PAID" ? "QPay-ээр төлөгдсөн байсан тул хэрэгжүүллээ" : "Төлбөрийг татгалзлаа",
  });
}
