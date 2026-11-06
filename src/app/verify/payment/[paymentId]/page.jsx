import { Suspense } from "react";
import { connection } from "next/server";
import { isValidPaymentSignature, loadPaymentDocument, paidVia } from "@/lib/billing/documents";
import { PAYMENT_PURPOSES } from "@/lib/billing/labels";
import { formatDateTime, formatMoney } from "@/lib/format";
import { SYSTEM_NAME } from "@/lib/system";
import { Card } from "@/components/Cards";
import { Loading } from "@/components/Messages";
import { InlineField } from "@/components/Fields";

export const metadata = { title: "Төлбөрийн баримт шалгах" };

const Row = (props) => <InlineField strong className="py-1.5 text-sm" {...props} />;

// Төлвөөс хамаарсан гарчиг: нэхэмжлэх (төлөгдөөгүй), зарлагын баримт (төлөгдсөн), хүчингүй
const STATES = {
  PENDING: {
    icon: "✓",
    tone: "text-amber-600",
    title: "Нэхэмжлэх жинхэнэ · төлөгдөөгүй",
    text: "нэхэмжилсэн. Төлбөр хараахан төлөгдөөгүй байна.",
  },
  PAID: {
    icon: "✓",
    tone: "text-green-600",
    title: "Баримт жинхэнэ · төлөгдсөн",
    text: "нэхэмжилсэн бөгөөд төлбөр төлөгдсөн. Энэ дугаартай нэхэмжлэх, зарлагын баримт хоёулаа хүчинтэй.",
  },
  CANCELLED: {
    icon: "!",
    tone: "text-gray-600",
    title: "Нэхэмжлэх цуцлагдсан",
    text: "нэхэмжилсэн боловч цуцлагдсан. Энэ нэхэмжлэхээр төлбөр бүү төлнө үү.",
  },
  REJECTED: {
    icon: "!",
    tone: "text-red-600",
    title: "Төлбөр татгалзагдсан",
    text: "нэхэмжилсэн боловч төлбөрийг татгалзсан. Энэ нэхэмжлэхээр төлбөр бүү төлнө үү.",
  },
};

// Нэхэмжлэх, зарлагын баримтын QR-аар нээгдэнэ (нэвтрэлтгүй). Гарын үсэг зөв, төлбөр DB-д байвал
// баримтын гол мэдээлэл ба одоогийн төлвийг харуулна.
const VerifyContent = async ({ params, searchParams }) => {
  await connection();
  const { paymentId } = await params;
  const { s } = await searchParams;
  const payment = isValidPaymentSignature(paymentId, s) ? await loadPaymentDocument(paymentId) : null;

  if (!payment) {
    return (
      <Card className="w-full max-w-md text-center">
        <p className="text-4xl">✕</p>
        <h1 className="text-lg font-semibold text-red-700">Баримт баталгаажаагүй</h1>
        <p className="text-sm text-gray-600">
          Энэ QR код {SYSTEM_NAME} системд бүртгэлгүй эсвэл баримт өөрчлөгдсөн байна. Баримтыг хүлээн авахгүй, төлбөр
          төлөхгүй байхыг зөвлөж байна.
        </p>
      </Card>
    );
  }

  const state = STATES[payment.status];
  return (
    <Card className="w-full max-w-md">
      <div className="space-y-1 text-center">
        <p className={`text-4xl ${state.tone}`}>{state.icon}</p>
        <h1 className={`text-lg font-semibold ${state.tone}`}>{state.title}</h1>
        <p className="text-sm text-gray-600">
          {SYSTEM_NAME} систем {state.text} Доорх мэдээлэл баримт дээрхтэй таарч байгааг шалгана уу.
        </p>
      </div>
      <dl className="divide-y divide-gray-100">
        <Row label="Дугаар" value={<span className="font-mono">{payment.reference}</span>} />
        <Row label="Байгууллага" value={payment.organization.name} />
        {payment.organization.registerNumber && <Row label="Регистр" value={payment.organization.registerNumber} />}
        <Row label="Утга" value={PAYMENT_PURPOSES[payment.purpose] ?? payment.purpose} />
        <Row label="Дүн" value={formatMoney(payment.amount)} />
        <Row label="Нэхэмжилсэн" value={formatDateTime(payment.createdAt)} />
        {payment.status === "PAID" && (
          <>
            <Row label="Төлсөн" value={formatDateTime(payment.paidAt)} />
            <Row label="Төлбөрийн хэрэгсэл" value={paidVia(payment)} />
          </>
        )}
      </dl>
    </Card>
  );
};

const VerifyPaymentPage = ({ params, searchParams }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-4 py-10">
    <p className="text-2xl font-bold tracking-tight text-gray-900">
      Verdec<span className="text-blue-600">X</span>
    </p>
    <Suspense fallback={<Loading />}>
      <VerifyContent params={params} searchParams={searchParams} />
    </Suspense>
  </div>
);

export default VerifyPaymentPage;
