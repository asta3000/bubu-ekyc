"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";

// Үнэгүй (суурь үнэ 0) багцыг сунгах дээд тоо. Анхны идэвхжүүлэлт тоонд орохгүй:
// 4 гэвэл нийт 5 удаа ашиглана.
const FreePlanSettings = ({ freeRenewalLimit }) => {
  const { errors, success, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    submit("/api/managements/settings/free-plan", "PUT", Object.fromEntries(new FormData(event.currentTarget)));
  };

  return (
    <Card
      title="Үнэгүй багц"
      description="Суурь үнэ 0 багцыг байгууллага анх идэвхжүүлснээс хойш хэдэн удаа сунгаж болох (автомат болон гараар). Жишээ нь 4 бол анхныхтай нийлээд 5 удаа ашиглана. Дууссаны дараа гэрээгүй байгууллагад гэрээ байгуулж, гэрээтэй байгууллагад хэтэвчээ цэнэглэж багцаа ахиулахыг санал болгоно."
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-full">
          <Message error={errors.form} success={success} />
        </div>
        <div className="w-64">
          <Input
            label="Сунгах дээд тоо"
            name="freeRenewalLimit"
            type="number"
            min={0}
            max={100}
            defaultValue={freeRenewalLimit}
            error={errors.freeRenewalLimit}
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

export default FreePlanSettings;
