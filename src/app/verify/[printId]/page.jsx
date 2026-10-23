import { Suspense } from "react";
import { connection } from "next/server";
import { formatDateTime, personName } from "@/lib/format";
import { sanctionSource } from "@/lib/sanctions/sources";
import { documentNumber, isValidPrintSignature, loadPrint, printMatch } from "@/lib/screening/prints";
import { SYSTEM_NAME } from "@/lib/system";
import { Card } from "@/components/Cards";
import { Loading } from "@/components/Messages";
import { InlineField } from "@/components/Fields";

export const metadata = { title: "Баримт шалгах" };

const Row = (props) => <InlineField strong className="py-1.5 text-sm" {...props} />;

// Хэвлэсэн тайлангийн QR-аар нээгдэнэ (нэвтрэлтгүй). Гарын үсэг зөв, хэвлэлт DB-д байвал
// баримтын гол мэдээллийг харуулж, цаасан дээрхтэй тулгах боломж олгоно.
const VerifyContent = async ({ params, searchParams }) => {
  await connection();
  const { printId } = await params;
  const { s } = await searchParams;
  const print = isValidPrintSignature(printId, s) ? await loadPrint({ id: printId }) : null;
  const match = print && printMatch(print);

  if (!match) {
    return (
      <Card className="w-full max-w-md text-center">
        <p className="text-4xl">✕</p>
        <h1 className="text-lg font-semibold text-red-700">Баримт баталгаажаагүй</h1>
        <p className="text-sm text-gray-600">
          Энэ QR код {SYSTEM_NAME} системд бүртгэлгүй эсвэл баримт өөрчлөгдсөн байна. Баримтыг хүлээн авахгүй байхыг
          зөвлөж байна.
        </p>
      </Card>
    );
  }

  const { screening } = print;
  return (
    <Card className="w-full max-w-md">
      <div className="space-y-1 text-center">
        <p className="text-4xl text-green-600">✓</p>
        <h1 className="text-lg font-semibold text-green-700">Баримт жинхэнэ</h1>
        <p className="text-sm text-gray-600">
          {SYSTEM_NAME} системээс хэвлэгдсэн. Доорх мэдээлэл цаасан дээрхтэй таарч байгааг шалгана уу.
        </p>
      </div>
      <dl className="divide-y divide-gray-100">
        <Row label="Баримтын дугаар" value={<span className="font-mono">{documentNumber(print)}</span>} />
        <Row label="Хэвлэсэн" value={`${formatDateTime(print.createdAt)} · ${personName(print.user)}`} />
        <Row label="Байгууллага" value={print.organization?.name ?? screening.organization?.name} />
        <Row label="Тулгасан нэр" value={screening.name} />
        <Row label="Тулгасан" value={`${formatDateTime(screening.createdAt)} · ${personName(screening.user)}`} />
        <Row label="Тохирсон этгээд" value={match.entry.name} />
        <Row label="Жагсаалт" value={sanctionSource(match.entry.source)?.name ?? match.entry.source} />
        <Row label="Оноо" value={match.score} />
      </dl>
    </Card>
  );
};

const VerifyPage = ({ params, searchParams }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 px-4 py-10">
    <p className="text-2xl font-bold tracking-tight text-gray-900">
      e-<span className="text-blue-600">KYC</span>
    </p>
    <Suspense fallback={<Loading />}>
      <VerifyContent params={params} searchParams={searchParams} />
    </Suspense>
  </div>
);

export default VerifyPage;
