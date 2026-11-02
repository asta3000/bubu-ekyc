"use client";

import { useState } from "react";
import { Badge } from "@/components/Badges";
import { Button } from "@/components/Buttons";
import { NewPasswordFields, SearchInput, Select } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { personName } from "@/lib/format";
import { ORG_ROLE_LABELS } from "@/lib/labels";
import { passwordMismatch } from "@/lib/validations";
import { FormActions, StatusBadge, StatusSelect, Toolbar, formatDate, useSubmit } from "@/app/managements/_components/ui";

const API = "/api/organizations/users";
const ROLE_OPTIONS = Object.entries(ORG_ROLE_LABELS).map(([value, label]) => ({ value, label }));

// Эрх (хэрэглэгч / байгууллагын админ), төлөв
const UserForm = ({ user, onDone }) => {
  const { errors, pending, submit } = useSubmit();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (await submit(`${API}/${user.id}`, "PATCH", data)) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Эрх" name="role" defaultValue={user.role} options={ROLE_OPTIONS} error={errors.role} />
        <StatusSelect defaultValue={user.status} error={errors.status} />
      </div>
      <p className="text-xs text-gray-500">
        Байгууллагын админ хэрэглэгчдийг удирдаж, өөрийн жагсаалт, үйлдлийн түүхийг харна. Идэвхгүй болгосон
        хэрэглэгч нэвтрэх боломжгүй болно.
      </p>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

// Шинэ нууц үг. Хэрэглэгчийн бусад төхөөрөмж дээрх session дуусна.
const PasswordForm = ({ user, onDone }) => {
  const { errors, setErrors, pending, submit } = useSubmit({ refresh: false });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const mismatch = passwordMismatch(form);
    if (mismatch) return setErrors(mismatch);
    if (await submit(`${API}/${user.id}/password`, "POST", { password: form.password })) onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form} />
      <NewPasswordFields errors={errors} />
      <p className="text-xs text-gray-500">
        Шинэ нууц үгийг хэрэглэгчид аюулгүй замаар дамжуулна уу. Хэрэглэгч нэвтэрсэн бүх төхөөрөмжөөс гарна.
      </p>
      <FormActions pending={pending} onCancel={onDone} />
    </form>
  );
};

const OrgUsersManager = ({ users, currentUserId }) => {
  // { type: "edit" | "password", user }
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const close = () => setModal(null);

  const search = query.trim().toLowerCase();
  const filtered = search
    ? users.filter((user) => [personName(user), user.email].some((value) => value.toLowerCase().includes(search)))
    : users;

  return (
    <div className="space-y-4">
      <Toolbar>
        <SearchInput
          placeholder="Нэр, и-мэйлээр хайх"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-sm"
        />
      </Toolbar>
      {filtered.length === 0 ? (
        <EmptyState>Хэрэглэгч олдсонгүй</EmptyState>
      ) : (
        <Table headers={["Нэр", "И-мэйл", "Холбоо барих", "Эрх", "Төлөв", "Бүртгүүлсэн", ""]}>
          {filtered.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <tr key={user.id}>
                <Cell className="font-medium text-gray-900">
                  {personName(user)}
                  {isSelf && <Badge className="ml-2">Та</Badge>}
                </Cell>
                <Cell className="text-gray-600">{user.email}</Cell>
                <Cell className="text-gray-600">{user.contact || "—"}</Cell>
                <Cell>
                  <Badge tone={user.role === "ORG_ADMIN" ? "blue" : "gray"}>{ORG_ROLE_LABELS[user.role]}</Badge>
                </Cell>
                <Cell>
                  <StatusBadge status={user.status} />
                </Cell>
                <Cell className="text-gray-500">{formatDate(user.createdAt)}</Cell>
                <Cell>
                  {isSelf ? (
                    <span className="text-xs text-gray-400">Профайл хэсгээс</span>
                  ) : (
                    <div className="flex justify-end gap-3 whitespace-nowrap">
                      <Button variant="link" onClick={() => setModal({ type: "edit", user })}>
                        Засах
                      </Button>
                      <Button variant="link" onClick={() => setModal({ type: "password", user })}>
                        Нууц үг солих
                      </Button>
                    </div>
                  )}
                </Cell>
              </tr>
            );
          })}
        </Table>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={close}
        title={modal ? `${personName(modal.user)} — ${modal.type === "edit" ? "эрх, төлөв" : "нууц үг солих"}` : ""}
        description={modal?.user.email}
      >
        {modal?.type === "edit" && <UserForm user={modal.user} onDone={close} />}
        {modal?.type === "password" && <PasswordForm user={modal.user} onDone={close} />}
      </Modal>
    </div>
  );
};

export default OrgUsersManager;
