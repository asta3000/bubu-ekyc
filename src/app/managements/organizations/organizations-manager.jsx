"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/Badges";
import { Button, CopyButton } from "@/components/Buttons";
import { FieldError, Input, Select } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { DEFAULT_REFERRAL_RATE, LOGO_TYPES, logoFileError } from "@/lib/validations";
import {
  FormActions,
  RowActions,
  StatusBadge,
  StatusSelect,
  Toolbar,
  formatDate,
  recordOptions,
  useSubmit,
} from "../_components/ui";

const API = "/api/managements/organizations";

// Лого байхгүй бол нэрийн эхний үсэг
const LogoImage = ({ src, name, className = "h-8 w-8" }) =>
  src ? (
    // API-аар дамжих лого тул next/image-ийн оптимизаци шаардахгүй img ашиглав
    <img src={src} alt="" className={`rounded bg-white object-contain ${className}`} />
  ) : (
    <span
      className={`flex items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500 ${className}`}
    >
      {name?.slice(0, 1).toUpperCase() || "?"}
    </span>
  );

// Лого сонгох: урьдчилан харах, солих, устгах. Файл нь "logo", устгах нь "removeLogo" талбараар явна.
const LogoField = ({ current, name, error }) => {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removed, setRemoved] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Сонгосон файлын түр URL-ийг солигдох, хаагдахад чөлөөлнө
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (event) => {
    const selected = event.target.files[0] ?? null;
    const message = selected && logoFileError(selected);
    setFileError(message);
    if (message) {
      inputRef.current.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
    setRemoved(false);
  };

  const clear = () => {
    inputRef.current.value = "";
    setFile(null);
    setFileError(null);
    setRemoved(true);
  };

  const shown = preview ?? (removed ? null : current);

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-gray-700">Лого</span>
      <div className="flex items-center gap-4">
        <LogoImage src={shown} name={name} className="h-16 w-16 border border-gray-200" />
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            name="logo"
            accept={LOGO_TYPES.join(",")}
            onChange={handleChange}
            className="block text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
          />
          <p className="text-xs text-gray-500">PNG, JPG, WEBP · 1MB хүртэл</p>
          {shown && (
            <Button variant="dangerLink" onClick={clear}>
              Лого устгах
            </Button>
          )}
        </div>
      </div>
      {removed && <input type="hidden" name="removeLogo" value="1" />}
      <FieldError error={fileError ?? error} />
    </div>
  );
};

// Промо код, урамшууллын хувь ба хуулах товч. Кодгүй бол "Үүсгэх" товчоор нөхөж үүсгэнэ.
const PromoCode = ({ code, rate, onCreate, disabled }) =>
  code ? (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm tracking-wider text-gray-900">{code}</span>
      <Badge tone="green">{rate}%</Badge>
      <CopyButton text={code} />
    </div>
  ) : (
    <Button variant="link" onClick={onCreate} disabled={disabled}>
      Үүсгэх
    </Button>
  );

// organization өгвөл засна, үгүй бол шинээр үүсгэнэ
const OrganizationForm = ({ organization, operations, onDone }) => {
  const { errors, pending, submit } = useSubmit();
  const [name, setName] = useState(organization?.name ?? "");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = organization
      ? await submit(`${API}/${organization.id}`, "PATCH", data)
      : await submit(API, "POST", data);
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <LogoField current={organization?.logo} name={name} error={errors.logo} />
      <Input
        label="Нэр"
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        error={errors.name}
        autoFocus
        required
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Үйл ажиллагаа"
          name="operationId"
          defaultValue={organization?.operationId ?? ""}
          placeholder="Сонгоогүй"
          options={recordOptions(operations)}
          error={errors.operationId}
        />
        <StatusSelect defaultValue={organization?.status} error={errors.status} />
      </div>
      <div className="space-y-1">
        <Input
          label="Санал болголтын урамшууллын хувь (%)"
          name="referralRate"
          type="number"
          min={0}
          max={50}
          defaultValue={organization?.promoRate ?? DEFAULT_REFERRAL_RATE}
          error={errors.referralRate}
        />
        <p className="text-xs text-gray-500">
          Энэ байгууллагын промо кодоор бүртгүүлсэн байгууллагуудын төлбөрөөс авах хувь. Өөрчлөлт цаашдын төлбөрөөс
          үйлчилнэ.
        </p>
      </div>
      <div className="space-y-1">
        <Input
          label="Санал болгосон байгууллагын промо код"
          name="referralCode"
          defaultValue={organization?.referralCode ?? ""}
          placeholder="Заавал биш"
          maxLength={32}
          className="font-mono uppercase"
          error={errors.referralCode}
        />
        <p className="text-xs text-gray-500">
          Промо кодын эзэн байгууллага энэ байгууллагын QPay, банкаар төлсөн төлбөрөөс урамшуулал авна. Анхны
          төлбөр хийгдсэний дараа өөрчлөх боломжгүй.
        </p>
      </div>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const OrganizationsManager = ({ organizations, operations }) => {
  // null: хаалттай, { organization: null }: шинэ, { organization }: засах
  const [modal, setModal] = useState(null);
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (organization) => {
    const message = `"${organization.name}"-г устгах уу? Байгууллагын хэрэглэгчид байгууллагаас салгагдана.`;
    if (window.confirm(message)) await submit(`${API}/${organization.id}`, "DELETE");
  };

  return (
    <div className="space-y-4">
      <Toolbar onCreate={() => setModal({ organization: null })} createLabel="Шинэ байгууллага" />
      <Message error={errors.form} />
      {organizations.length === 0 ? (
        <EmptyState>Байгууллага бүртгэгдээгүй байна</EmptyState>
      ) : (
        <Table headers={["", "Нэр", "Үйл ажиллагаа", "Промо код", "Санал болгосон", "Хэрэглэгч", "Төлөв", "Үүсгэсэн", ""]}>
          {organizations.map((organization) => (
            <tr key={organization.id}>
              <Cell className="w-12">
                <LogoImage src={organization.logo} name={organization.name} />
              </Cell>
              <Cell className="font-medium text-gray-900">{organization.name}</Cell>
              <Cell className="text-gray-600">{organization.operation?.name ?? "—"}</Cell>
              <Cell className="whitespace-nowrap">
                <PromoCode
                  code={organization.promoCode}
                  rate={organization.promoRate}
                  onCreate={() => submit(`${API}/${organization.id}/promo`, "POST")}
                  disabled={pending}
                />
              </Cell>
              <Cell className="text-gray-600">{organization.referredBy ?? "—"}</Cell>
              <Cell>{organization._count.users}</Cell>
              <Cell>
                <StatusBadge status={organization.status} />
              </Cell>
              <Cell className="text-gray-500">{formatDate(organization.createdAt)}</Cell>
              <Cell>
                <RowActions
                  onEdit={() => setModal({ organization })}
                  onDelete={() => remove(organization)}
                  disabled={pending}
                />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={close}
        title={modal?.organization ? "Байгууллага засах" : "Шинэ байгууллага"}
      >
        <OrganizationForm
          organization={modal?.organization}
          operations={operations}
          onDone={close}
        />
      </Modal>
    </div>
  );
};

export default OrganizationsManager;
