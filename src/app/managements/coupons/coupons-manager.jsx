"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/Badges";
import { CopyButton } from "@/components/Buttons";
import { Input, Select } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { COUPON_TYPES, couponBenefit } from "@/lib/billing/labels";
import { formatDate, personName } from "@/lib/format";
import { FormActions, RowActions, StatusSelect, Toolbar, recordOptions, toOptions, useSubmit } from "../_components/ui";

const API = "/api/managements/coupons";


const STATES = {
  ACTIVE: { label: "Идэвхтэй", tone: "green" },
  INACTIVE: { label: "Идэвхгүй", tone: "gray" },
  SCHEDULED: { label: "Эхлээгүй", tone: "blue" },
  EXPIRED: { label: "Хугацаа дууссан", tone: "amber" },
  EXHAUSTED: { label: "Ашиглалт дууссан", tone: "amber" },
};

const formatPeriod = ({ startsAt, expiresAt }) =>
  startsAt || expiresAt ? `${startsAt ? formatDate(startsAt) : "…"} – ${expiresAt ? formatDate(expiresAt) : "…"}` : "Хязгааргүй";

// <input type="date">-д Улаанбаатарын цагаар yyyy-mm-dd
const dateValue = (date) => (date ? formatDate(date) : "");

// coupon өгвөл засна, үгүй бол шинээр үүсгэнэ
// organizations: купоныг тодорхой байгууллагад зориулахад сонгох жагсаалт
const CouponForm = ({ coupon, organizations, onDone }) => {
  const { errors, pending, submit } = useSubmit();
  const [discountType, setDiscountType] = useState(coupon?.discountType ?? "PERCENT");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const ok = coupon ? await submit(`${API}/${coupon.id}`, "PATCH", data) : await submit(API, "POST", data);
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <Input
        label="Код"
        name="code"
        defaultValue={coupon?.code}
        placeholder={coupon ? undefined : "Хоосон бол автоматаар үүснэ"}
        maxLength={32}
        className="font-mono uppercase"
        error={errors.code}
        autoFocus
      />
      <Input
        label="Тайлбар"
        name="description"
        defaultValue={coupon?.description ?? ""}
        maxLength={200}
        error={errors.description}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Купоны төрөл"
          name="discountType"
          value={discountType}
          onChange={(event) => setDiscountType(event.target.value)}
          options={toOptions(COUPON_TYPES)}
          error={errors.discountType}
        />
        <Input
          label={{ PERCENT: "Хувь", AMOUNT: "Дүн (₮)", EXTEND_DAYS: "Хоног" }[discountType]}
          name="discountValue"
          type="number"
          min={1}
          max={discountType === "PERCENT" ? 100 : undefined}
          defaultValue={coupon?.discountValue}
          error={errors.discountValue}
          required
        />
        <Input
          label="Эхлэх огноо"
          name="startsAt"
          type="date"
          defaultValue={dateValue(coupon?.startsAt)}
          error={errors.startsAt}
        />
        <Input
          label="Дуусах огноо"
          name="expiresAt"
          type="date"
          defaultValue={dateValue(coupon?.expiresAt)}
          error={errors.expiresAt}
        />
        <Input
          label="Ашиглах дээд тоо"
          name="usageLimit"
          type="number"
          min={1}
          placeholder="Хязгааргүй"
          defaultValue={coupon?.usageLimit ?? ""}
          error={errors.usageLimit}
        />
        <StatusSelect defaultValue={coupon?.status} error={errors.status} />
        <div className="sm:col-span-2">
          <Select
            label="Ашиглах байгууллага"
            name="organizationId"
            defaultValue={coupon?.organizationId ?? ""}
            placeholder="Бүх байгууллага"
            options={recordOptions(organizations)}
            error={errors.organizationId}
          />
        </div>
      </div>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const CouponsManager = ({ coupons, organizations }) => {
  // null: хаалттай, { coupon: null }: шинэ, { coupon }: засах
  const [modal, setModal] = useState(null);
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (coupon) => {
    if (window.confirm(`"${coupon.code}" купоныг устгах уу?`)) await submit(`${API}/${coupon.id}`, "DELETE");
  };

  return (
    <div className="space-y-4">
      <Toolbar onCreate={() => setModal({ coupon: null })} createLabel="Шинэ купон" />
      <Message error={errors.form} />
      {coupons.length === 0 ? (
        <EmptyState>Купон үүсгээгүй байна</EmptyState>
      ) : (
        <Table headers={["Код", "Давуу тал", "Байгууллага", "Ашигласан", "Хугацаа", "Төлөв", "Үүсгэсэн", ""]}>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <Cell>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium tracking-wider text-gray-900">{coupon.code}</span>
                  <CopyButton text={coupon.code} />
                </div>
                {coupon.description && <p className="text-xs text-gray-500">{coupon.description}</p>}
              </Cell>
              <Cell className="whitespace-nowrap font-medium">{couponBenefit(coupon)}</Cell>
              <Cell className="text-gray-600">{coupon.organization?.name ?? "Бүх байгууллага"}</Cell>
              <Cell className="whitespace-nowrap">
                {coupon.usedCount} / {coupon.usageLimit ?? "∞"}
              </Cell>
              <Cell className="whitespace-nowrap text-gray-600">{formatPeriod(coupon)}</Cell>
              <Cell>
                <StatusBadge status={coupon.state} statuses={STATES} />
              </Cell>
              <Cell className="whitespace-nowrap text-gray-500">
                {formatDate(coupon.createdAt)}
                <p className="text-xs">{personName(coupon.createdBy)}</p>
              </Cell>
              <Cell>
                <RowActions
                  onEdit={() => setModal({ coupon })}
                  onDelete={() => remove(coupon)}
                  disabled={pending}
                />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={Boolean(modal)} onClose={close} title={modal?.coupon ? "Купон засах" : "Шинэ купон"}>
        <CouponForm coupon={modal?.coupon} organizations={organizations} onDone={close} />
      </Modal>
    </div>
  );
};

export default CouponsManager;
