import Link from "next/link";
import { billableService, includesQuota } from "@/lib/billing/services";
import { noSubscriptionMessage, serviceAllowance } from "@/lib/billing/usage";
import { formatMoney } from "@/lib/format";

const BILLING_LINK = (
  <Link href="/organizations/billing" className="font-medium underline">
    Багц, төлбөр
  </Link>
);

const TONES = {
  blue: { banner: "bg-blue-50 text-blue-800", card: "border-blue-200 bg-blue-50 text-blue-900" },
  amber: { banner: "bg-amber-50 text-amber-800", card: "border-amber-200 bg-amber-50 text-amber-900" },
  red: { banner: "bg-red-50 text-red-700", card: "border-red-200 bg-red-50 text-red-800" },
};

// Үйлчилгээний багцын төлөв: { tone, count?, label?, text }. reason: багцгүй үеийн шалтгаан
function allowanceState({ subscription, item, remaining }, unit, reason) {
  if (!subscription) {
    return { tone: "red", text: <>{reason} {BILLING_LINK}</> };
  }
  if (!item) return { tone: "red", text: <>Таны багцад энэ үйлчилгээ ороогүй. {BILLING_LINK}</> };
  if (!includesQuota(subscription.basePrice, item.quota)) {
    return { tone: "blue", text: <>Ашиглах бүрт {formatMoney(item.unitPrice)} хэтэвчнээс төлөгдөнө. {BILLING_LINK}</> };
  }
  const after = item.unitPrice > 0 ? `Дууссаны дараа ${formatMoney(item.unitPrice)}/удаа.` : "Дууссаны дараа ашиглах боломжгүй.";
  if (remaining > 0) {
    return {
      tone: "blue",
      count: remaining,
      label: `${unit} үлдсэн`,
      text: (
        <>
          Багцаас {remaining} {unit} үлдсэн ({subscription.packageName}). {after}
        </>
      ),
      detail: `${subscription.packageName} · ${after}`,
    };
  }
  if (item.unitPrice === 0) {
    return {
      tone: "red",
      count: 0,
      label: `${unit} үлдсэн`,
      text: <>Багцын тоо дууссан тул ашиглах боломжгүй. {BILLING_LINK} хэсгээс багцаа сунгана уу.</>,
    };
  }
  return {
    tone: "amber",
    count: 0,
    label: `${unit} үлдсэн`,
    text: <>Багцын тоо дууссан. Цааш ашиглавал {formatMoney(item.unitPrice)}/удаа хэтэвчнээс төлөгдөнө. {BILLING_LINK}</>,
  };
}

// Үйлчилгээний хуудсанд: багцаас үлдсэн тоо, дууссаны дараах үнэ.
// size="large": гарчгийн баруун талд (PageTitle aside) том тоогоор харуулна
const ServiceAllowance = async ({ organization, service, size = "banner" }) => {
  if (!organization) return null;
  const allowance = await serviceAllowance(organization.id, service);
  const reason = allowance.subscription ? null : await noSubscriptionMessage(organization.id);
  const state = allowanceState(allowance, billableService(service)?.unit ?? "", reason);
  const tone = TONES[state.tone];

  if (size !== "large") return <p className={`rounded-lg px-4 py-2 text-sm ${tone.banner}`}>{state.text}</p>;

  return (
    <div className={`rounded-xl border px-4 py-3 sm:text-right ${tone.card}`}>
      {state.count != null ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">Багцын үлдэгдэл</p>
          <p className="flex items-baseline gap-2 sm:justify-end">
            <span className="text-4xl font-bold leading-tight tabular-nums">{state.count.toLocaleString("en-US")}</span>
            <span className="text-sm font-medium">{state.label}</span>
          </p>
          <p className="text-xs opacity-80">{state.detail ?? state.text}</p>
        </>
      ) : (
        <p className="text-sm">{state.text}</p>
      )}
    </div>
  );
};

export default ServiceAllowance;
