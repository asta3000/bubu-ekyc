"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { personName } from "@/lib/format";
import {
  FormActions,
  RowActions,
  StatusBadge,
  StatusSelect,
  Toolbar,
  formatDate,
  useSubmit,
} from "@/app/managements/_components/ui";

const API = "/api/organizations/lists";

// list өгвөл засна, үгүй бол шинээр үүсгээд бичлэг нэмэх хуудас руу нь шилжинэ
const ListForm = ({ list, onDone }) => {
  const router = useRouter();
  const { errors, pending, submit, send } = useSubmit({ refresh: Boolean(list) });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (list) {
      if (await submit(`${API}/${list.id}`, "PATCH", data)) onDone();
      return;
    }
    const result = await send(API, "POST", data);
    if (result.ok) router.push(`/organizations/lists/${result.list.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      {!list && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          Жагсаалт бол бичлэгүүдийн сав (жишээ нь "Хар жагсаалт", "Өндөр эрсдэлтэй харилцагч"). Хүн, байгууллагыг
          дараагийн алхамд жагсаалт дотроо нэмнэ.
        </p>
      )}
      <Input
        label="Жагсаалтын нэр"
        name="name"
        defaultValue={list?.name}
        maxLength={100}
        placeholder="Хар жагсаалт"
        error={errors.name}
        required
        autoFocus
      />
      <Textarea
        label="Тайлбар"
        name="description"
        rows={3}
        maxLength={300}
        defaultValue={list?.description ?? ""}
        error={errors.description}
      />
      <StatusSelect defaultValue={list?.status} error={errors.status} />
      <p className="text-xs text-gray-500">Идэвхгүй жагсаалт хориг тулгахад орохгүй.</p>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const ListsManager = ({ lists }) => {
  // null: хаалттай, { list: null }: шинэ, { list }: засах
  const [modal, setModal] = useState(null);
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (list) => {
    const message = `"${list.name}" жагсаалтыг ${list._count.entries} бичлэгтэй нь устгах уу? Өмнөх тулгалтын үр дүн хадгалагдана.`;
    if (window.confirm(message)) await submit(`${API}/${list.id}`, "DELETE");
  };

  return (
    <div className="space-y-4">
      <Toolbar onCreate={() => setModal({ list: null })} createLabel="Шинэ жагсаалт" />
      <Message error={errors.form} />
      {lists.length === 0 ? (
        <EmptyState>Жагсаалт үүсгээгүй байна</EmptyState>
      ) : (
        <Table headers={["Нэр", "Бичлэг", "Төлөв", "Шинэчилсэн", "Үүсгэсэн", ""]}>
          {lists.map((list) => (
            <tr key={list.id}>
              <Cell>
                <Link href={`/organizations/lists/${list.id}`} className="font-medium text-blue-600 hover:underline">
                  {list.name}
                </Link>
                {list.description && <p className="text-xs text-gray-500">{list.description}</p>}
              </Cell>
              <Cell className="whitespace-nowrap">
                {list._count.entries ? (
                  list._count.entries.toLocaleString("en-US")
                ) : (
                  <Link href={`/organizations/lists/${list.id}`} className="text-amber-700 hover:underline">
                    Хоосон · бичлэг нэмэх
                  </Link>
                )}
              </Cell>
              <Cell>
                <StatusBadge status={list.status} />
              </Cell>
              <Cell className="whitespace-nowrap text-gray-500">{formatDate(list.updatedAt)}</Cell>
              <Cell className="whitespace-nowrap text-gray-500">
                {formatDate(list.createdAt)}
                <p className="text-xs">{personName(list.createdBy)}</p>
              </Cell>
              <Cell>
                <RowActions onEdit={() => setModal({ list })} onDelete={() => remove(list)} disabled={pending} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={Boolean(modal)} onClose={close} title={modal?.list ? "Жагсаалт засах" : "Шинэ жагсаалт"}>
        <ListForm list={modal?.list} onDone={close} />
      </Modal>
    </div>
  );
};

export default ListsManager;
