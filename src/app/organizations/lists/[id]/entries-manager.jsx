"use client";

import { useState } from "react";
import { Input, SearchInput, Select, Textarea } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { FormActions, RowActions, Toolbar, formatDate, toOptions, useSubmit } from "@/app/managements/_components/ui";
import { SUBJECT_LABELS } from "../../_components/labels";

// entry өгвөл засна, үгүй бол шинээр нэмнэ
const EntryForm = ({ api, entry, countries, onDone }) => {
  const { errors, pending, submit } = useSubmit();
  const [subjectType, setSubjectType] = useState(entry?.subjectType ?? "INDIVIDUAL");
  const isIndividual = subjectType === "INDIVIDUAL";

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const ok = entry ? await submit(`${api}/${entry.id}`, "PATCH", data) : await submit(api, "POST", data);
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Төрөл"
          name="subjectType"
          value={subjectType}
          onChange={(event) => setSubjectType(event.target.value)}
          options={toOptions(SUBJECT_LABELS)}
          error={errors.subjectType}
        />
        <Input
          label={isIndividual ? "Овог нэр" : "Нэр"}
          name="name"
          defaultValue={entry?.name}
          maxLength={200}
          error={errors.name}
          required
          autoFocus
        />
      </div>
      <Textarea
        label="Өөр нэрс (мөр бүрт нэг)"
        name="aliases"
        rows={2}
        defaultValue={entry?.aliases ?? ""}
        placeholder={isIndividual ? "Латин, кирилл бичлэг, хуучин нэр" : "Товчилсон нэр, хуучин нэр"}
        error={errors.aliases}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={isIndividual ? "Төрсөн он/огноо" : "Үүсгэн байгуулагдсан он/огноо"}
          name="birthDate"
          defaultValue={entry?.birthDate ?? ""}
          placeholder="1975 эсвэл 1975-03-21"
          error={errors.birthDate}
        />
        <Select
          label={isIndividual ? "Иргэншил" : "Улс"}
          name="country"
          defaultValue={entry?.country ?? ""}
          placeholder="Сонгоогүй"
          options={countries}
          error={errors.country}
        />
        <Input
          label={isIndividual ? "Регистр, паспортын дугаар" : "Регистрийн дугаар"}
          name="identifier"
          defaultValue={entry?.identifier ?? ""}
          maxLength={100}
          error={errors.identifier}
        />
        <Input label="Хаяг" name="address" defaultValue={entry?.address ?? ""} maxLength={300} error={errors.address} />
      </div>
      <Textarea
        label="Тайлбар (жагсаалтад оруулсан шалтгаан)"
        name="remarks"
        rows={3}
        maxLength={1000}
        defaultValue={entry?.remarks ?? ""}
        error={errors.remarks}
      />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const EntriesManager = ({ listId, entries, countries }) => {
  const api = `/api/organizations/lists/${listId}/entries`;
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (entry) => {
    if (window.confirm(`"${entry.name}"-г жагсаалтаас хасах уу?`)) await submit(`${api}/${entry.id}`, "DELETE");
  };

  const search = query.trim().toLowerCase();
  const filtered = search
    ? entries.filter((entry) =>
        [entry.name, entry.aliases, entry.identifier].some((value) => value.toLowerCase().includes(search)),
      )
    : entries;

  return (
    <div className="space-y-4">
      <Toolbar onCreate={() => setModal({ entry: null })} createLabel="Бичлэг нэмэх">
        <SearchInput
          placeholder="Нэр, дугаараар хайх"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-sm"
        />
      </Toolbar>
      <Message error={errors.form} />
      {filtered.length === 0 ? (
        <EmptyState>
          {entries.length
            ? "Бичлэг олдсонгүй"
            : "Жагсаалт хоосон байна. Тулгалтад орох хүн, байгууллагыг \"+ Бичлэг нэмэх\" товчоор нэмнэ үү."}
        </EmptyState>
      ) : (
        <Table headers={["Нэр", "Төрөл", "Он/огноо", "Улс", "Дугаар", "Нэмсэн", ""]}>
          {filtered.map((entry) => (
            <tr key={entry.id}>
              <Cell>
                <p className="font-medium text-gray-900">{entry.name}</p>
                {entry.aliases && <p className="text-xs text-gray-500">{entry.aliases.split("\n").join(", ")}</p>}
                {entry.remarks && <p className="text-xs text-gray-500">{entry.remarks}</p>}
              </Cell>
              <Cell className="whitespace-nowrap">{SUBJECT_LABELS[entry.subjectType]}</Cell>
              <Cell className="whitespace-nowrap text-gray-600">{entry.birthDate || "—"}</Cell>
              <Cell className="text-gray-600">{entry.display.nationalities[0] ?? "—"}</Cell>
              <Cell className="font-mono text-xs text-gray-600">{entry.identifier || "—"}</Cell>
              <Cell className="whitespace-nowrap text-gray-500">{formatDate(entry.display.createdAt)}</Cell>
              <Cell>
                <RowActions onEdit={() => setModal({ entry })} onDelete={() => remove(entry)} disabled={pending} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={Boolean(modal)} onClose={close} title={modal?.entry ? "Бичлэг засах" : "Бичлэг нэмэх"}>
        {modal && <EntryForm api={api} entry={modal.entry} countries={countries} onDone={close} />}
      </Modal>
    </div>
  );
};

export default EntriesManager;
