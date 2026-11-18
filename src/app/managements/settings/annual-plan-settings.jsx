"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";

// Багцыг жилээр худалдан авах үеийн хөнгөлөлтийн хувь ба хүчинтэй хугацаа
const AnnualPlanSettings = ({ discountRate, durationDays }) => {
  const { errors, success, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    submit("/api/managements/settings/annual-plan", "PUT", Object.fromEntries(new FormData(event.currentTarget)));
  };

  return (
    <Card
      title="Жилийн багц"
      description="Багцыг жилээр худалдан авахад суурь үнээс хасах хөнгөлөлтийн хувь ба багцын хүчинтэй хугацаа. Дараагийн худалдан авалтаас үйлчилнэ."
      className="flex h-full w-full flex-col"
    >
      <form onSubmit={handleSubmit} className="mt-auto flex flex-wrap items-end gap-3">
        <div className="w-full">
          <Message error={errors.form} success={success} />
        </div>
        <div className="min-w-28 flex-1">
          <Input
            label="Жилийн үнийн хөнгөлөлт (%)"
            name="annualDiscountRate"
            type="number"
            min={0}
            max={100}
            defaultValue={discountRate}
            error={errors.annualDiscountRate}
            required
          />
        </div>
        <div className="min-w-28 flex-1">
          <Input
            label="Багцын жилийн хугацаа (хоног)"
            name="annualDurationDays"
            type="number"
            min={1}
            max={3650}
            defaultValue={durationDays}
            error={errors.annualDurationDays}
            required
          />
        </div>
        <div className="w-32">
          <PrimaryButton pending={pending}>Хадгалах</PrimaryButton>
        </div>
      </form>
    </Card>
  );
};

export default AnnualPlanSettings;
