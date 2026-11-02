"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";

// Бүртгүүлэх хэсгийн тохиргоо: гэрээ байгуулаагүй байгууллагын хэрэглэгчийн дээд тоо
const RegistrationSettings = ({ uncontractedUserLimit }) => {
  const { errors, success, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    submit("/api/managements/settings/registration", "PUT", Object.fromEntries(new FormData(event.currentTarget)));
  };

  return (
    <Card
      title="Бүртгэл"
      description="Гэрээ байгуулаагүй байгууллагад харилцагчийн дугаараар бүртгүүлж нэгдэх хэрэглэгчийн дээд тоо (байгууллагыг бүртгэсэн хэрэглэгч ч тоонд орно). Гэрээ байгуулсан байгууллагад хязгааргүй. Өмнө бүртгэгдсэн хэрэглэгчдэд нөлөөлөхгүй."
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-full">
          <Message error={errors.form} success={success} />
        </div>
        <div className="w-64">
          <Input
            label="Гэрээгүй байгууллагын хэрэглэгчийн дээд тоо"
            name="uncontractedUserLimit"
            type="number"
            min={1}
            max={1000}
            defaultValue={uncontractedUserLimit}
            error={errors.uncontractedUserLimit}
            required
          />
        </div>
        <div className="w-40">
          <PrimaryButton pending={pending}>Хадгалах</PrimaryButton>
        </div>
      </form>
    </Card>
  );
};

export default RegistrationSettings;
