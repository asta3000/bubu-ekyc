"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/Badges";
import { Button } from "@/components/Buttons";
import { EmptyState, Message } from "@/components/Messages";
import { Cell, Table } from "@/components/Tables";
import { PAYMENT_METHODS, PAYMENT_STATUSES, paymentPurpose } from "@/lib/billing/labels";
import { sendJson } from "@/lib/fetcher";
import { formatDateTime, formatMoney, personName } from "@/lib/format";
import { useSubmit } from "../_components/ui";

const API = "/api/managements/payments";

const FILTERS = [
  { key: "PENDING", label: "Хүлээгдэж буй" },
  { key: "ALL", label: "Бүгд" },
];

// Хүлээгдэж буй төлбөрийн үйлдэл: банкны шилжүүлгийг баталгаажуулах, QPay-г шалгах,
// аль алиныг нь татгалзах. QPay-ээс шалгаж чадахгүй бол админы зөвшөөрлөөр хүчээр хаана.
const PaymentActions = ({ payment, submit, pending, onError }) => {
  const router = useRouter();
  if (payment.status !== "PENDING") return null;

  const confirm = () => {
    const message = `${payment.organization.name}-ийн ${formatMoney(payment.amount)} (утга: ${payment.reference}) шилжүүлэг данс руу орсныг баталгаажуулах уу?`;
    if (window.confirm(message)) submit(`${API}/${payment.id}/confirm`, "POST");
  };

  const reject = async () => {
    const adminNote = window.prompt("Татгалзах шалтгаан (байгууллагад харагдана):");
    if (adminNote === null) return;
    let result = await sendJson(`${API}/${payment.id}/reject`, "POST", { adminNote });
    if (
      result.code === "QPAY_UNAVAILABLE" &&
      window.confirm(`${result.error}\n\nТөлөгдөөгүй гэдэгт итгэлтэй бол хүчээр хаах уу?`)
    ) {
      result = await sendJson(`${API}/${payment.id}/reject`, "POST", { adminNote, force: true });
    }
    if (!result.ok) return onError(result.errors.form);
    if (result.paid) window.alert(result.message);
    router.refresh();
  };

  return (
    <div className="flex justify-end gap-3">
      {payment.method === "QPAY" ? (
        <Button variant="link" onClick={() => submit(`${API}/${payment.id}/check`, "POST")} disabled={pending}>
          Шалгах
        </Button>
      ) : (
        <Button variant="link" onClick={confirm} disabled={pending}>
          Баталгаажуулах
        </Button>
      )}
      <Button variant="dangerLink" onClick={reject} disabled={pending}>
        Татгалзах
      </Button>
    </div>
  );
};

const PaymentsManager = ({ payments }) => {
  const [filter, setFilter] = useState("PENDING");
  const { errors, pending, submit } = useSubmit();
  const [actionError, setActionError] = useState(null);
  const shown = filter === "ALL" ? payments : payments.filter((payment) => payment.status === "PENDING");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Төлбөрүүд</h2>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-md px-3 py-1 text-sm ${filter === item.key ? "bg-white font-medium shadow-sm" : "text-gray-600"}`}
            >
              {item.label}
              {item.key === "PENDING" && ` (${payments.filter((p) => p.status === "PENDING").length})`}
            </button>
          ))}
        </div>
      </div>
      <Message error={actionError ?? errors.form} />
      {shown.length === 0 ? (
        <EmptyState>{filter === "PENDING" ? "Хүлээгдэж буй төлбөр байхгүй" : "Төлбөр байхгүй"}</EmptyState>
      ) : (
        <Table headers={["Огноо", "Байгууллага", "Зориулалт", "Арга", "Дүн", "Гүйлгээний утга", "Төлөв", ""]}>
          {shown.map((payment) => (
            <tr key={payment.id}>
              <Cell className="whitespace-nowrap text-gray-600">
                {formatDateTime(payment.createdAt)}
                <p className="text-xs text-gray-400">{personName(payment.createdBy)}</p>
              </Cell>
              <Cell className="font-medium text-gray-900">{payment.organization.name}</Cell>
              <Cell className="text-gray-700">{paymentPurpose(payment)}</Cell>
              <Cell className="whitespace-nowrap text-gray-700">{PAYMENT_METHODS[payment.method]}</Cell>
              <Cell className="whitespace-nowrap font-medium">{formatMoney(payment.amount)}</Cell>
              <Cell className="font-mono text-xs">{payment.reference}</Cell>
              <Cell>
                <StatusBadge status={payment.status} statuses={PAYMENT_STATUSES} />
                {payment.reviewedBy && <p className="mt-1 text-xs text-gray-400">{personName(payment.reviewedBy)}</p>}
                {payment.adminNote && <p className="mt-1 max-w-xs text-xs text-gray-500">{payment.adminNote}</p>}
              </Cell>
              <Cell>
                <PaymentActions payment={payment} submit={submit} pending={pending} onError={setActionError} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
};

export default PaymentsManager;
