"use client";

import { useState } from "react";
import { Input } from "@/components/Inputs";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { formatMoney } from "@/lib/format";
import { FormActions, RowActions, StatusBadge, StatusSelect, useSubmit } from "../_components/ui";

const API = "/api/managements/addons";

const AddonForm = ({ addon, onDone }) => {
  const { errors, pending, submit } = useSubmit();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await submit(`${API}/${addon.key}`, "PUT", {
      price: form.get("price"),
      durationDays: form.get("durationDays"),
      status: form.get("status"),
    });
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">{addon.description}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Үнэ (₮)" name="price" type="number" min={0} defaultValue={addon.price ?? ""} error={errors.price} required autoFocus />
        <Input
          label="Хугацаа (хоног)"
          name="durationDays"
          type="number"
          min={1}
          defaultValue={addon.durationDays ?? 30}
          error={errors.durationDays}
          required
        />
        <StatusSelect defaultValue={addon.status ?? "INACTIVE"} error={errors.status} />
      </div>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

// addons: [{ key, name, description, price, durationDays, status, activeCount }]. Үнэ
// тохируулаагүй (price хоосон) жагсаалтыг байгууллага худалдаж авах боломжгүй.
const AddonsManager = ({ addons }) => {
  const [editing, setEditing] = useState(null);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Улсын нэмэлт жагсаалт</h2>
        <p className="text-sm text-gray-500">
          Байгууллага идэвхтэй багц дээрээ хэтэвчнээсээ худалдаж авна. Үнийн өөрчлөлт зөвхөн шинэ худалдан авалтад нөлөөлнө.
        </p>
      </div>
      <Table headers={["Жагсаалт", "Үнэ", "Хугацаа", "Идэвхтэй", "Төлөв", ""]}>
        {addons.map((addon) => (
          <tr key={addon.key}>
            <Cell>
              <p className="font-medium text-gray-900">{addon.name}</p>
              <p className="text-xs text-gray-500">{addon.description}</p>
            </Cell>
            <Cell className="whitespace-nowrap font-medium">{addon.price == null ? "—" : formatMoney(addon.price)}</Cell>
            <Cell className="whitespace-nowrap text-gray-600">{addon.durationDays ? `${addon.durationDays} хоног` : "—"}</Cell>
            <Cell>{addon.activeCount}</Cell>
            <Cell>{addon.status ? <StatusBadge status={addon.status} /> : <span className="text-xs text-gray-500">Тохируулаагүй</span>}</Cell>
            <Cell>
              <RowActions onEdit={() => setEditing(addon)} />
            </Cell>
          </tr>
        ))}
      </Table>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.name ?? ""}>
        {editing && <AddonForm addon={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
};

export default AddonsManager;
