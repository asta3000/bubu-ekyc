"use client";

import { StatusBadge as BaseStatusBadge } from "@/components/Badges";
import { Button, PrimaryButton } from "@/components/Buttons";
import { Select } from "@/components/Inputs";
import { STATUS_LABELS } from "@/lib/labels";

export { ROLE_LABELS, STATUS_LABELS } from "@/lib/labels";

export const toOptions = (labels) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

// Идэвхгүй бичлэгийг сонголтод тэмдэглэнэ
export const recordOptions = (records) =>
  records.map(({ id, name, status }) => ({
    value: id,
    label: status === "ACTIVE" ? name : `${name} (${STATUS_LABELS[status]})`,
  }));

// Огноог Улаанбаатарын цагаар (lib/format)
export { formatDate, formatDateTime } from "@/lib/format";

// Form илгээх нийтлэг hook (lib/use-submit)
export { useSubmit } from "@/lib/use-submit";

const RECORD_STATUSES = {
  ACTIVE: { label: STATUS_LABELS.ACTIVE, tone: "green" },
  INACTIVE: { label: STATUS_LABELS.INACTIVE, tone: "gray" },
};

export const StatusBadge = ({ status }) => <BaseStatusBadge status={status} statuses={RECORD_STATUSES} />;

export const StatusSelect = ({ defaultValue = "ACTIVE", error }) => (
  <Select
    label="Төлөв"
    name="status"
    defaultValue={defaultValue}
    options={toOptions(STATUS_LABELS)}
    error={error}
  />
);

// Modal-ийн доод талын "Цуцлах", "Хадгалах" товчнууд
export const FormActions = ({ pending, onCancel }) => (
  <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
    <Button onClick={onCancel} disabled={pending}>
      Цуцлах
    </Button>
    <div className="w-32">
      <PrimaryButton pending={pending} pendingText="Хадгалж байна...">
        Хадгалах
      </PrimaryButton>
    </div>
  </div>
);

// Жагсаалтын дээд мөр: зүүн талд хайлт г.м., баруун талд "Шинэ ..." товч
export const Toolbar = ({ children, onCreate, createLabel }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0 flex-1">{children}</div>
    {onCreate && (
      <Button variant="primary" onClick={onCreate}>
        + {createLabel}
      </Button>
    )}
  </div>
);

// Мөрийн "Засах", "Устгах" товчнууд
export const RowActions = ({ onEdit, onDelete, disabled }) => (
  <div className="flex justify-end gap-3">
    <Button variant="link" onClick={onEdit} disabled={disabled}>
      Засах
    </Button>
    {onDelete && (
      <Button variant="dangerLink" onClick={onDelete} disabled={disabled}>
        Устгах
      </Button>
    )}
  </div>
);
