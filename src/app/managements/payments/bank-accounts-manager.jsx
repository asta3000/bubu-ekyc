"use client";

import { useState } from "react";
import { Button } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { FormActions, StatusBadge, StatusSelect, useSubmit } from "../_components/ui";

const API = "/api/managements/bank-accounts";

const AccountForm = ({ account, onDone }) => {
  const { errors, pending, submit } = useSubmit();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const ok = account ? await submit(`${API}/${account.id}`, "PATCH", data) : await submit(API, "POST", data);
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <Input label="Банкны нэр" name="bankName" defaultValue={account?.bankName} placeholder="Хаан банк" error={errors.bankName} autoFocus required />
      <Input label="Дансны нэр (хүлээн авагч)" name="accountName" defaultValue={account?.accountName} error={errors.accountName} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Дансны дугаар" name="accountNumber" defaultValue={account?.accountNumber} inputMode="numeric" error={errors.accountNumber} required />
        <Input label="IBAN (заавал биш)" name="iban" defaultValue={account?.iban ?? ""} error={errors.iban} />
        <Input label="Дараалал" name="sortOrder" type="number" min={0} max={99} defaultValue={account?.sortOrder ?? 0} error={errors.sortOrder} />
        <StatusSelect defaultValue={account?.status} error={errors.status} />
      </div>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

// Банкны шилжүүлгийн үед байгууллагад зэрэг харуулах хүлээн авагч данснууд (max хүртэл)
const BankAccountsManager = ({ accounts, max }) => {
  const [modal, setModal] = useState(null);
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (account) => {
    if (window.confirm(`${account.bankName} ${account.accountNumber} дансыг устгах уу?`)) {
      await submit(`${API}/${account.id}`, "DELETE");
    }
  };

  return (
    <Card
      title="Хүлээн авах данс"
      description={`Банкны шилжүүлгээр төлөх үед идэвхтэй бүх данс зэрэг харагдана. Хамгийн ихдээ ${max} данс.`}
    >
      <Message error={errors.form} />
      <div className="grid gap-3 md:grid-cols-2">
        {accounts.map((account) => (
          <div key={account.id} className="space-y-1 rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-900">{account.bankName}</p>
              <StatusBadge status={account.status} />
            </div>
            <p className="text-gray-700">{account.accountName}</p>
            <p className="font-mono text-gray-900">{account.accountNumber}</p>
            {account.iban && <p className="font-mono text-xs text-gray-500">IBAN: {account.iban}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="link" onClick={() => setModal({ account })} disabled={pending}>
                Засах
              </Button>
              <Button variant="dangerLink" onClick={() => remove(account)} disabled={pending}>
                Устгах
              </Button>
            </div>
          </div>
        ))}
        {accounts.length < max && (
          <button
            type="button"
            onClick={() => setModal({ account: null })}
            className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
          >
            + Данс нэмэх
          </button>
        )}
      </div>
      <Modal open={Boolean(modal)} onClose={close} title={modal?.account ? "Данс засах" : "Данс нэмэх"}>
        <AccountForm account={modal?.account} onDone={close} />
      </Modal>
    </Card>
  );
};

export default BankAccountsManager;
