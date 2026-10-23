"use client";

import { Button, CopyButton } from "@/components/Buttons";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";
import { formatMoney } from "@/lib/format";

const Row = ({ label, value, copy, mono }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className={`flex items-center gap-2 text-right text-gray-900 ${mono ? "font-mono" : ""}`}>
      {value}
      {copy && <CopyButton text={copy} />}
    </span>
  </div>
);

// Банкны шилжүүлэг: админы тохируулсан бүх дансыг зэрэг харуулна
const BankTransfer = ({ payment, bankAccounts }) => (
  <div className="space-y-4">
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      Доорх данснуудын аль нэг рүү <b>{formatMoney(payment.amount)}</b> шилжүүлж, гүйлгээний утгад{" "}
      <b className="font-mono">{payment.reference}</b> гэж заавал бичнэ үү. Админ шилжүүлгийг шалгаж баталгаажуулсны
      дараа хэрэгжинэ.
    </div>
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-4">
      <Row label="Дүн" value={formatMoney(payment.amount)} copy={String(payment.amount)} />
      <Row label="Гүйлгээний утга" value={payment.reference} copy={payment.reference} mono />
    </div>
    {bankAccounts.length === 0 ? (
      <Message error="Хүлээн авах данс тохируулаагүй байна. Админд хандана уу." />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {bankAccounts.map((account) => (
          <div key={account.id} className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-4 py-2">
            <p className="pb-2 font-semibold text-gray-900">{account.bankName}</p>
            <Row label="Хүлээн авагч" value={account.accountName} />
            <Row label="Данс" value={account.accountNumber} copy={account.accountNumber.replace(/\s/g, "")} mono />
            {account.iban && <Row label="IBAN" value={account.iban} copy={account.iban.replace(/\s/g, "")} mono />}
          </div>
        ))}
      </div>
    )}
  </div>
);

// QPay: QR код ба банкны апп-ын холбоосууд
const Qpay = ({ payment }) => {
  const invoice = payment.qpayInvoice ?? {};
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-gray-600">
        Банкны аппаараа QR кодыг уншуулж <b>{formatMoney(payment.amount)}</b> төлнө үү.
      </p>
      {invoice.qrImage && (
        <img
          src={`data:image/png;base64,${invoice.qrImage}`}
          alt="QPay QR код"
          className="mx-auto h-56 w-56 rounded-lg border border-gray-200"
        />
      )}
      {invoice.urls?.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:hidden">
          {invoice.urls.map((url) => (
            <a key={url.name} href={url.link} className="flex flex-col items-center gap-1 text-center text-[10px] text-gray-600">
              <img src={url.logo} alt="" className="h-10 w-10 rounded-lg" />
              {url.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// Хүлээгдэж буй төлбөрийн заавар, "Төлбөр шалгах", "Цуцлах" товч
const PaymentInstructions = ({ payment, bankAccounts, onClose }) => {
  // success: QPay-ээс шалгасан хариу ("хараахан төлөгдөөгүй" г.м.)
  const { errors, success, pending, send } = useSubmit();

  const call = async (action) => {
    const result = await send(`/api/organizations/billing/payments/${payment.id}/${action}`, "POST");
    if (result.ok && (action === "cancel" || result.paid)) onClose();
  };

  return (
    <div className="space-y-4">
      <Message error={errors.form} />
      {success && <p className="rounded-md bg-gray-50 p-2 text-sm text-gray-600">{success}</p>}
      {payment.method === "QPAY" ? <Qpay payment={payment} /> : <BankTransfer payment={payment} bankAccounts={bankAccounts} />}
      <div className="flex justify-between gap-2 border-t border-gray-100 pt-4">
        <Button variant="dangerLink" onClick={() => window.confirm("Төлбөрийг цуцлах уу?") && call("cancel")} disabled={pending}>
          Цуцлах
        </Button>
        <div className="flex gap-2">
          <Button onClick={onClose} disabled={pending}>
            Хаах
          </Button>
          {payment.method === "QPAY" && (
            <Button variant="primary" onClick={() => call("check")} disabled={pending}>
              {pending ? "Шалгаж байна..." : "Төлбөр шалгах"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentInstructions;
