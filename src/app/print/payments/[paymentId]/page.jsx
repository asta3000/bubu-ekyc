import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DOCUMENT_TYPES, documentAvailable, loadPaymentDocument, renderDocumentHtml } from "@/lib/billing/documents";
import { requireOrganizationPage } from "@/lib/organization-access";
import { AccessDenied, Loading } from "@/components/Messages";
import PrintToolbar from "../../screenings/[printId]/print-toolbar";

// Төлбөрийн баримт хэвлэх: ?type=invoice (нэхэмжлэх) | receipt (зарлагын) | income (орлогын, зөвхөн ADMIN).
// Нэг гүйлгээнд нэг л баримт тул дахин хэвлэхэд ижил дугаартай ижил баримт гарна.
const PaymentPrintContent = async ({ params, searchParams }) => {
  const { session, organization, accessError } = await requireOrganizationPage();
  const { paymentId } = await params;
  const { type = "invoice" } = await searchParams;
  const page = { title: DOCUMENT_TYPES[type]?.name ?? "Баримт" };
  if (accessError) return <AccessDenied {...page} error={accessError} />;

  const admin = session.user.role === "ADMIN";
  if (!DOCUMENT_TYPES[type] || (type === "income" && !admin)) notFound();
  const payment = await loadPaymentDocument(paymentId);
  // Байгууллагын хэрэглэгч зөвхөн өөрийн байгууллагын төлбөрийг
  if (!payment || (!admin && payment.organizationId !== organization?.id)) notFound();
  if (!documentAvailable(payment, type)) {
    return <AccessDenied {...page} error="Энэ гүйлгээнд энэ баримт үүсэхгүй (төлөгдөөгүй эсвэл хэтэвчээр төлсөн)." />;
  }

  return (
    <>
      <style>{"@page { size: A4; margin: 1.5cm; }"}</style>
      <PrintToolbar />
      <article
        className="mx-auto mb-8 w-[210mm] bg-white p-[1.5cm] shadow print:m-0 print:w-auto print:p-0 print:shadow-none"
        // Сервер дээр escape хийж үүсгэсэн баримт (имэйлтэй ижил загвар)
        dangerouslySetInnerHTML={{ __html: await renderDocumentHtml(type, payment) }}
      />
    </>
  );
};

// Session, DB-г request үед уншдаг тул cacheComponents-д Suspense-д ороосон
const PaymentPrintPage = ({ params, searchParams }) => (
  <Suspense fallback={<Loading className="p-4" />}>
    <PaymentPrintContent params={params} searchParams={searchParams} />
  </Suspense>
);

export default PaymentPrintPage;
