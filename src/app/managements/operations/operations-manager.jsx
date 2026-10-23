"use client";

import { useState } from "react";
import { Input } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import {
  FormActions,
  RowActions,
  StatusBadge,
  StatusSelect,
  Toolbar,
  formatDate,
  useSubmit,
} from "../_components/ui";

const API = "/api/managements/operations";

// operation өгвөл засна, үгүй бол шинээр үүсгэнэ
const OperationForm = ({ operation, onDone }) => {
  const { errors, pending, submit } = useSubmit();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const ok = operation
      ? await submit(`${API}/${operation.id}`, "PATCH", data)
      : await submit(API, "POST", data);
    if (ok) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <Input
        label="Нэр"
        name="name"
        defaultValue={operation?.name}
        maxLength={100}
        error={errors.name}
        autoFocus
        required
      />
      <StatusSelect defaultValue={operation?.status} error={errors.status} />
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const OperationsManager = ({ operations }) => {
  // null: хаалттай, { operation: null }: шинэ, { operation }: засах
  const [modal, setModal] = useState(null);
  const { errors, pending, submit } = useSubmit();
  const close = () => setModal(null);

  const remove = async (operation) => {
    const message = `"${operation.name}"-г устгах уу? Харьяалагдах байгууллагууд үйл ажиллагаанаас салгагдана.`;
    if (window.confirm(message)) await submit(`${API}/${operation.id}`, "DELETE");
  };

  return (
    <div className="space-y-4">
      <Toolbar onCreate={() => setModal({ operation: null })} createLabel="Шинэ үйл ажиллагаа" />
      <Message error={errors.form} />
      {operations.length === 0 ? (
        <EmptyState>Үйл ажиллагаа бүртгэгдээгүй байна</EmptyState>
      ) : (
        <Table headers={["Нэр", "Байгууллага", "Төлөв", "Үүсгэсэн", ""]}>
          {operations.map((operation) => (
            <tr key={operation.id}>
              <Cell className="font-medium text-gray-900">{operation.name}</Cell>
              <Cell>{operation._count.organizations}</Cell>
              <Cell>
                <StatusBadge status={operation.status} />
              </Cell>
              <Cell className="text-gray-500">{formatDate(operation.createdAt)}</Cell>
              <Cell>
                <RowActions
                  onEdit={() => setModal({ operation })}
                  onDelete={() => remove(operation)}
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
        title={modal?.operation ? "Үйл ажиллагаа засах" : "Шинэ үйл ажиллагаа"}
      >
        <OperationForm operation={modal?.operation} onDone={close} />
      </Modal>
    </div>
  );
};

export default OperationsManager;
