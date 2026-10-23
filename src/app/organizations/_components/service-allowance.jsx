import Link from "next/link";
import { billableService } from "@/lib/billing/services";
import { serviceAllowance } from "@/lib/billing/usage";
import { formatMoney } from "@/lib/format";

const BILLING_LINK = (
  <Link href="/organizations/billing" className="font-medium underline">
    Багц, төлбөр
  </Link>
);

// Үйлчилгээний хуудасны дээд талд: багцаас үлдсэн тоо, дууссаны дараах үнэ
const ServiceAllowance = async ({ organization, service }) => {
  if (!organization) return null;
  const { subscription, item, remaining } = await serviceAllowance(organization.id, service);
  const unit = billableService(service)?.unit ?? "";

  let tone = "bg-blue-50 text-blue-800";
  let text;
  if (!subscription) {
    tone = "bg-red-50 text-red-700";
    text = <>Идэвхтэй багц байхгүй тул ашиглах боломжгүй. {BILLING_LINK} хэсгээс багц сонгоно уу.</>;
  } else if (!item) {
    tone = "bg-red-50 text-red-700";
    text = <>Таны багцад энэ үйлчилгээ ороогүй. {BILLING_LINK}</>;
  } else if (subscription.basePrice === 0) {
    text = <>Ашиглах бүрт {formatMoney(item.unitPrice)} хэтэвчнээс төлөгдөнө. {BILLING_LINK}</>;
  } else if (remaining > 0) {
    text = (
      <>
        Багцаас {remaining} {unit} үлдсэн ({subscription.packageName}). Дууссаны дараа {formatMoney(item.unitPrice)}/удаа.
      </>
    );
  } else {
    tone = "bg-amber-50 text-amber-800";
    text = (
      <>
        Багцын тоо дууссан. Цааш ашиглавал {formatMoney(item.unitPrice)}/удаа хэтэвчнээс төлөгдөнө. {BILLING_LINK}
      </>
    );
  }
  return <p className={`rounded-lg px-4 py-2 text-sm ${tone}`}>{text}</p>;
};

export default ServiceAllowance;
