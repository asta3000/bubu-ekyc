"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";

// Регистрийн дугаараар ХУР-аас шалгах. defaultRegnum: баримтаас уншсан (кирилл болгосон) утга
const RegistryForm = ({ verificationId, defaultRegnum, disabled }) => {
  const { errors, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    submit(`/api/organizations/verifications/${verificationId}/registry`, "POST", data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Message error={errors.form} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input
          label="Регистрийн дугаар"
          name="regnum"
          defaultValue={defaultRegnum}
          placeholder="УБ90010112"
          maxLength={10}
          error={errors.regnum}
          disabled={disabled}
          required
        />
        <Input
          label="Иргэний хувийн дугаар (заавал биш)"
          name="civilId"
          inputMode="numeric"
          maxLength={20}
          error={errors.civilId}
          disabled={disabled}
        />
        <div className="w-full sm:w-40">
          <PrimaryButton pending={pending} pendingText="Шалгаж байна..." disabled={disabled || pending}>
            ХУР-аас шалгах
          </PrimaryButton>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Баримтаас латин үсгээр уншсан тул О/Ө, У/Ү, Е/Э үсгийг шалгаад шаардлагатай бол засна уу.
      </p>
    </form>
  );
};

export default RegistryForm;
