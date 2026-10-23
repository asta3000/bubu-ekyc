"use client";

import { useState } from "react";
import { Checkbox, FieldError, Input, Textarea } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { BILLABLE_SERVICES, serviceName } from "@/lib/billing/services";
import { formatMoney } from "@/lib/format";
import { FormActions, RowActions, StatusBadge, StatusSelect, Toolbar, useSubmit } from "../_components/ui";

const API = "/api/managements/packages";

// Үйлчилгээ бүрийн мөр: багтах эсэх, суурь үнэд багтах тоо, задгай үнэ
const ServiceRow = ({ service, item, includesQuota }) => {
  const [enabled, setEnabled] = useState(Boolean(item));
  return (
    <div className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_8rem_8rem]">
      <Checkbox
        label={service.name}
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
        className="pb-2"
      />
      <Input
        label="Тоо"
        name={`quota.${service.key}`}
        type="number"
        min={0}
        defaultValue={item?.quota ?? 0}
        disabled={!enabled || !includesQuota}
        title={includesQuota ? undefined : "Суурь үнэ 0 үед бүх ашиглалт задгай үнээр"}
      />
      <Input
        label="Задгай үнэ (₮)"
        name={`unitPrice.${service.key}`}
        type="number"
        min={0}
        defaultValue={item?.unitPrice ?? 0}
        disabled={!enabled}
      />
      {enabled && <input type="hidden" name="services" value={service.key} />}
    </div>
  );
};

// pkg өгвөл засна, үгүй бол шинээр үүсгэнэ
const PackageForm = ({ pkg, onDone }) => {
  const { errors, pending, submit } = useSubmit();
  const [basePrice, setBasePrice] = useState(String(pkg?.basePrice ?? ""));
  const includesQuota = Number(basePrice) > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      name: form.get("name"),
      description: form.get("description"),
      basePrice: form.get("basePrice"),
      durationDays: form.get("durationDays"),
      status: form.get("status"),
      items: form.getAll("services").map((service) => ({
        service,
        // Суурь үнэ 0 бол тоо хэрэглэгдэхгүй
        quota: includesQuota ? form.get(`quota.${service}`) : 0,
        unitPrice: form.get(`unitPrice.${service}`),
      })),
    };
    const ok = pkg ? await submit(`${API}/${pkg.id}`, "PATCH", data) : await submit(API, "POST", data);
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <Input label="Нэр" name="name" defaultValue={pkg?.name} maxLength={100} error={errors.name} autoFocus required />
      <Textarea label="Тайлбар" name="description" defaultValue={pkg?.description ?? ""} rows={2} maxLength={500} error={errors.description} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Суурь үнэ (₮)"
          name="basePrice"
          type="number"
          min={0}
          value={basePrice}
          onChange={(event) => setBasePrice(event.target.value)}
          error={errors.basePrice}
          required
        />
        <Input
          label="Хугацаа (хоног)"
          name="durationDays"
          type="number"
          min={1}
          placeholder="Хугацаагүй"
          defaultValue={pkg?.durationDays ?? ""}
          error={errors.durationDays}
        />
        <StatusSelect defaultValue={pkg?.status} error={errors.status} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Үйлчилгээнүүд</p>
        <p className="text-xs text-gray-500">
          {includesQuota
            ? "Суурь үнэ төлсний дараа тоогоо байгууллагын ажилтнууд дундаа хэрэглэнэ. Тоо дууссаны дараа ашиглах бүрт задгай үнийг хэтэвчнээс төлнө."
            : "Суурь үнэ 0 тул бүх ашиглалт задгай үнээр хэтэвчнээс төлөгдөнө."}
        </p>
        {BILLABLE_SERVICES.map((service) => (
          <ServiceRow
            key={service.key}
            service={service}
            item={pkg?.items.find((item) => item.service === service.key)}
            includesQuota={includesQuota}
          />
        ))}
        <FieldError error={errors.items} />
      </div>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const PackagesManager = ({ packages }) => {
  const [modal, setModal] = useState(null);
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (pkg) => {
    const message = `"${pkg.name}" багцыг устгах уу? Худалдаж авсан байгууллагуудын багц хэвээр үлдэнэ.`;
    if (window.confirm(message)) await submit(`${API}/${pkg.id}`, "DELETE");
  };

  return (
    <div className="space-y-4">
      <Toolbar onCreate={() => setModal({ pkg: null })} createLabel="Шинэ багц" />
      <Message error={errors.form} />
      {packages.length === 0 ? (
        <EmptyState>Багц үүсгээгүй байна</EmptyState>
      ) : (
        <Table headers={["Нэр", "Суурь үнэ", "Хугацаа", "Үйлчилгээ (тоо · задгай үнэ)", "Идэвхтэй", "Төлөв", ""]}>
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <Cell>
                <p className="font-medium text-gray-900">{pkg.name}</p>
                {pkg.description && <p className="text-xs text-gray-500">{pkg.description}</p>}
              </Cell>
              <Cell className="whitespace-nowrap font-medium">{formatMoney(pkg.basePrice)}</Cell>
              <Cell className="whitespace-nowrap text-gray-600">
                {pkg.durationDays ? `${pkg.durationDays} хоног` : "Хугацаагүй"}
              </Cell>
              <Cell className="text-gray-700">
                {pkg.items.map((item) => (
                  <p key={item.service} className="whitespace-nowrap">
                    {serviceName(item.service)}: {pkg.basePrice > 0 ? item.quota : "—"} · {formatMoney(item.unitPrice)}
                  </p>
                ))}
              </Cell>
              <Cell>{pkg._count.subscriptions}</Cell>
              <Cell>
                <StatusBadge status={pkg.status} />
              </Cell>
              <Cell>
                <RowActions onEdit={() => setModal({ pkg })} onDelete={() => remove(pkg)} disabled={pending} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={Boolean(modal)} onClose={close} title={modal?.pkg ? "Багц засах" : "Шинэ багц"} className="max-w-2xl">
        <PackageForm pkg={modal?.pkg} onDone={close} />
      </Modal>
    </div>
  );
};

export default PackagesManager;
