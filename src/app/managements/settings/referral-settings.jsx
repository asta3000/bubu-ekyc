"use client";

import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";

// Санал болголтын 2-р шатны хувь. 1-р шатны хувь байгууллага бүрийн промо кодонд
// (Байгууллага хэсэгт) тохируулагдана.
const ReferralSettings = ({ secondRate }) => {
  const { errors, success, pending, submit } = useSubmit();

  const handleSubmit = (event) => {
    event.preventDefault();
    submit("/api/managements/settings/referral", "PUT", Object.fromEntries(new FormData(event.currentTarget)));
  };

  return (
    <Card
      title="Санал болголтын урамшуулал"
      description="Байгууллага QPay, банкаар төлбөр хийхэд түүнийг урьсан байгууллага промо кодынхоо хувиар (Байгууллага хэсэгт тохируулна), харин урьсан байгууллагыг нь урьсан байгууллага энд тохируулсан хувиар урамшуулал авна. Өөрчлөлт цаашдын төлбөрөөс үйлчилнэ."
      className="w-full"
    >
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-full">
          <Message error={errors.form} success={success} />
        </div>
        <div className="w-64">
          <Input
            label="Урьсан байгууллагыг урьсан байгууллагад (%)"
            name="secondRate"
            type="number"
            min={0}
            max={50}
            defaultValue={secondRate}
            error={errors.secondRate}
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

export default ReferralSettings;
