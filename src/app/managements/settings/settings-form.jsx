"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input, Textarea } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";

const SettingsForm = ({ settings }) => {
  const { errors, success, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    submit("/api/managements/settings", "PUT", Object.fromEntries(new FormData(event.currentTarget)));
  };

  return (
    <Card
      title="Холбоо барих мэдээлэл"
      description="Хэвлэх тайлангийн толгойд харагдана. Хоосон орхисон талбар тайланд гарахгүй (зориулалт, вэбсайт нь анхны утгаараа гарна)."
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Message error={errors.form} success={success} />
        <Textarea
          label="Системийн зориулалт"
          name="purpose"
          rows={2}
          maxLength={200}
          defaultValue={settings.purpose}
          placeholder="Харилцагчийг таньж мэдэх (KYC), хоригийн жагсаалттай тулгах систем"
          error={errors.purpose}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Вэбсайт" name="website" type="url" defaultValue={settings.website} placeholder="https://ekyc.mn" error={errors.website} />
          <Input label="И-мэйл" name="email" type="email" defaultValue={settings.email} placeholder="info@ekyc.mn" error={errors.email} />
          <Input label="Утас" name="phone" type="tel" maxLength={50} defaultValue={settings.phone} placeholder="7700-0000" error={errors.phone} />
        </div>
        <Textarea label="Хаяг" name="address" rows={2} maxLength={300} defaultValue={settings.address} error={errors.address} />
        <div className="w-40">
          <PrimaryButton pending={pending}>Хадгалах</PrimaryButton>
        </div>
      </form>
    </Card>
  );
};

export default SettingsForm;
