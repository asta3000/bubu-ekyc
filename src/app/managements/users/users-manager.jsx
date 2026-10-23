"use client";

import { useState } from "react";
import { SearchInput, Select } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { personName } from "@/lib/format";
import {
  FormActions,
  ROLE_LABELS,
  RowActions,
  StatusBadge,
  StatusSelect,
  Toolbar,
  formatDate,
  recordOptions,
  toOptions,
  useSubmit,
} from "../_components/ui";


const UserForm = ({ user, organizations, isSelf, onDone }) => {
  const { errors, pending, submit } = useSubmit();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    // Өөрийн эрх, төлөвийг өөрчлөхгүй (disabled талбар FormData-д орохгүй)
    if (isSelf) Object.assign(data, { role: user.role, status: user.status });
    if (await submit(`/api/managements/users/${user.id}`, "PATCH", data)) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <Select
        label="Байгууллага"
        name="organizationId"
        defaultValue={user.organizationId ?? ""}
        placeholder="Сонгоогүй"
        options={recordOptions(organizations)}
        error={errors.organizationId}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Эрх"
          name="role"
          defaultValue={user.role}
          options={toOptions(ROLE_LABELS)}
          error={errors.role}
          disabled={isSelf}
        />
        <fieldset disabled={isSelf}>
          <StatusSelect defaultValue={user.status} error={errors.status} />
        </fieldset>
      </div>
      {isSelf && (
        <p className="text-xs text-gray-500">Өөрийн эрх, төлөвийг өөрчлөх боломжгүй.</p>
      )}
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const UsersManager = ({ users, organizations, currentUserId }) => {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const close = () => setEditing(null);

  const search = query.trim().toLowerCase();
  const filtered = search
    ? users.filter((user) =>
        [personName(user), user.email, user.organization?.name ?? ""].some((value) =>
          value.toLowerCase().includes(search),
        ),
      )
    : users;

  return (
    <div className="space-y-4">
      <Toolbar>
        <SearchInput
          placeholder="Нэр, и-мэйл, байгууллагаар хайх"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-sm"
        />
      </Toolbar>
      {filtered.length === 0 ? (
        <EmptyState>Хэрэглэгч олдсонгүй</EmptyState>
      ) : (
        <Table headers={["Нэр", "И-мэйл", "Байгууллага", "Эрх", "Төлөв", "Бүртгүүлсэн", ""]}>
          {filtered.map((user) => (
            <tr key={user.id}>
              <Cell className="font-medium text-gray-900">{personName(user)}</Cell>
              <Cell className="text-gray-600">{user.email}</Cell>
              <Cell className="text-gray-600">{user.organization?.name ?? "—"}</Cell>
              <Cell>{ROLE_LABELS[user.role]}</Cell>
              <Cell>
                <StatusBadge status={user.status} />
              </Cell>
              <Cell className="text-gray-500">{formatDate(user.createdAt)}</Cell>
              <Cell>
                <RowActions onEdit={() => setEditing(user)} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={close}
        title={editing ? `${personName(editing)} засах` : ""}
        description={editing?.email}
      >
        {editing && (
          <UserForm
            user={editing}
            organizations={organizations}
            isSelf={editing.id === currentUserId}
            onDone={close}
          />
        )}
      </Modal>
    </div>
  );
};

export default UsersManager;
