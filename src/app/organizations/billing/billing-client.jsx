"use client";

import { useState } from "react";
import { Badge, StatusBadge } from "@/components/Badges";
import { Button, CopyButton, PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { FieldError, Input } from "@/components/Inputs";
import { EmptyState, Message } from "@/components/Messages";
import { Modal } from "@/components/Modals";
import { Cell, Table } from "@/components/Tables";
import { PAYMENT_METHODS, PAYMENT_STATUSES, WALLET_TRANSACTION_TYPES, paymentPurpose } from "@/lib/billing/labels";
import { billableService, includesQuota } from "@/lib/billing/services";
import { useSubmit } from "@/lib/use-submit";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import PaymentInstructions from "../_components/payment-instructions";

// Төлбөрийн арга сонгох товчнууд
const MethodPicker = ({ methods, value, onChange }) => (
  <div className="grid gap-2 sm:grid-cols-3">
    {methods.map((method) => (
      <button
        key={method.key}
        type="button"
        disabled={method.disabled}
        onClick={() => onChange(method.key)}
        className={`rounded-lg border p-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          value === method.key ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <span className="block font-medium text-gray-900">{method.label}</span>
        {method.hint && <span className="block text-xs text-gray-500">{method.hint}</span>}
      </button>
    ))}
  </div>
);

// Хүсэлт илгээж, хүлээгдэж буй төлбөр үүсвэл заавар руу шилжинэ
function usePaymentRequest(onPayment, onDone) {
  const { errors, pending, send } = useSubmit();

  const request = async (url, data) => {
    const result = await send(url, "POST", data);
    if (!result.ok) return;
    if (result.paymentId) onPayment(result.paymentId);
    else onDone();
  };
  return { errors, pending, send: request };
}

// minTopup: цэнэглэх доод дүн (хамгийн хямд багцын үнэ)
const TopupForm = ({ qpayEnabled, minTopup, suggested = 0, onPayment, onDone }) => {
  const [method, setMethod] = useState(qpayEnabled ? "QPAY" : "BANK_TRANSFER");
  const { errors, pending, send } = usePaymentRequest(onPayment, onDone);

  const handleSubmit = (event) => {
    event.preventDefault();
    send("/api/organizations/billing/topup", { amount: new FormData(event.currentTarget).get("amount"), method });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Message error={errors.form ?? errors.method} />
      <Input
        label="Дүн (₮)"
        name="amount"
        type="number"
        min={minTopup}
        defaultValue={Math.max(minTopup, suggested)}
        error={errors.amount}
        autoFocus
        required
      />
      <p className="-mt-2 text-xs text-gray-500">Доод дүн {formatMoney(minTopup)} (хамгийн хямд багцын үнэ)</p>
      <MethodPicker
        value={method}
        onChange={setMethod}
        methods={[
          { key: "QPAY", label: "QPay", hint: qpayEnabled ? "Шууд цэнэглэгдэнэ" : "Тохируулаагүй", disabled: !qpayEnabled },
          { key: "BANK_TRANSFER", label: "Банкны шилжүүлэг", hint: "Админ баталгаажуулна" },
        ]}
      />
      <PrimaryButton pending={pending}>Үргэлжлүүлэх</PrimaryButton>
    </form>
  );
};

const PackageItems = ({ pkg }) => (
  <ul className="space-y-1 text-sm">
    {pkg.items.map((item) => {
      const service = billableService(item.service);
      return (
        <li key={item.service} className="flex justify-between gap-2">
          <span className="text-gray-600">{service?.name ?? item.service}</span>
          <span className="text-right text-gray-900">
            {includesQuota(pkg.basePrice, item.quota) && `${item.quota} ${service?.unit ?? ""}`}
            {includesQuota(pkg.basePrice, item.quota) && item.unitPrice > 0 && " · "}
            {(item.unitPrice > 0 || !includesQuota(pkg.basePrice, item.quota)) && `${formatMoney(item.unitPrice)}/удаа`}
          </span>
        </li>
      );
    })}
  </ul>
);

// Купон код оруулж урьдчилан шалгах. applied: шалгагдсан купоны үр дүн
const CouponField = ({ pkg, applied, onApply, onRemove, error }) => {
  const [code, setCode] = useState("");
  // Урьдчилан харах тул хуудсыг дахин уншихгүй
  const { errors, pending, send } = useSubmit({ refresh: false });

  const apply = async () => {
    const result = await send("/api/organizations/billing/coupon", "POST", { packageId: pkg.id, couponCode: code });
    if (result.ok) onApply(result);
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
        <span className="text-green-800">
          Купон <b className="font-mono">{applied.code}</b>: {applied.benefit}
        </span>
        <Button variant="dangerLink" onClick={onRemove}>
          Хасах
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          placeholder="Купон код (заавал биш)"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          // Enter дарахад худалдан авалтын form биш купон шалгагдана
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (code.trim()) apply();
          }}
          className="font-mono uppercase"
          maxLength={32}
        />
        <Button onClick={apply} disabled={!code.trim() || pending}>
          {pending ? "..." : "Хэрэглэх"}
        </Button>
      </div>
      <FieldError error={errors.couponCode ?? errors.form ?? error} />
    </div>
  );
};

// current: одоогийн идэвхтэй багц (үлдэгдэл шилжих эсэхийг тайлбарлахад).
// renew: идэвхтэй багцаа гараар сунгах (ижил багцыг дахин авах, шинэ хугацаа одооноос эхэлнэ).
const PurchaseForm = ({ pkg, current, renew = false, balance, qpayEnabled, onPayment, onDone }) => {
  const [coupon, setCoupon] = useState(null);
  const price = coupon?.finalPrice ?? pkg.basePrice;
  const durationDays = coupon?.durationDays ?? pkg.durationDays;
  const free = price === 0;
  const enoughBalance = balance >= price;
  // Үнэ өөрчлөгдөхөд (купон) тохирох төлбөрийн аргыг дахин сонгоно
  const defaultMethod = (amount) => (amount === 0 || balance >= amount ? "WALLET" : qpayEnabled ? "QPAY" : "BANK_TRANSFER");
  const [method, setMethod] = useState(defaultMethod(pkg.basePrice));
  const { errors, pending, send } = usePaymentRequest(onPayment, onDone);

  const changeCoupon = (next) => {
    setCoupon(next);
    setMethod(defaultMethod(next?.finalPrice ?? pkg.basePrice));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send("/api/organizations/billing/purchase", { packageId: pkg.id, method, couponCode: coupon?.code ?? null });
      }}
      className="space-y-4"
    >
      <Message error={errors.form ?? errors.method} />
      <div className="space-y-2 rounded-lg bg-gray-50 p-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Суурь үнэ</span>
          <span className={coupon?.discountAmount ? "text-gray-400 line-through" : "font-semibold"}>
            {formatMoney(pkg.basePrice)}
          </span>
        </div>
        {coupon?.discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Төлөх (купон −{formatMoney(coupon.discountAmount)})</span>
            <span className="font-semibold text-green-700">{formatMoney(price)}</span>
          </div>
        )}
        {durationDays && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Хугацаа</span>
            <span>
              {durationDays} хоног
              {coupon?.extraDays > 0 && <span className="text-green-700"> (+{coupon.extraDays} купон)</span>}
            </span>
          </div>
        )}
        <PackageItems pkg={pkg} />
      </div>
      {pkg.basePrice > 0 || pkg.durationDays ? (
        <CouponField
          pkg={pkg}
          applied={coupon}
          onApply={changeCoupon}
          onRemove={() => changeCoupon(null)}
          error={errors.couponCode}
        />
      ) : null}
      <p className="text-xs text-gray-500">
        {current &&
          (renew
            ? `Сунгахад одоогийн багц дуусч, шинэ хугацаа, багцын тоо одооноос эхэлнэ. Одоогийн багцын үлдсэн хоног, ашиглаагүй тоо шилжихгүй. `
            : `Шинэ багц идэвхжихэд "${current.packageName}" багц дуусч, үлдсэн тоо шилжихгүй. `)}
        {pkg.basePrice === 0 &&
          (pkg.items.some((item) => item.quota > 0)
            ? "Суурь үнэгүй. Багцын тоо дууссаны дараа ашиглах бүрт задгай үнийг хэтэвчнээс төлнө."
            : "Суурь үнэгүй тул ашиглах бүрт задгай үнийг хэтэвчнээс төлнө.")}
      </p>
      {!free && (
        <MethodPicker
          value={method}
          onChange={setMethod}
          methods={[
            { key: "WALLET", label: "Хэтэвч", hint: `Үлдэгдэл ${formatMoney(balance)}`, disabled: !enoughBalance },
            { key: "QPAY", label: "QPay", hint: qpayEnabled ? "Шууд идэвхжинэ" : "Тохируулаагүй", disabled: !qpayEnabled },
            { key: "BANK_TRANSFER", label: "Банкны шилжүүлэг", hint: "Админ баталгаажуулна" },
          ]}
        />
      )}
      <PrimaryButton pending={pending}>
        {free || method === "WALLET" ? (renew ? "Сунгах" : "Идэвхжүүлэх") : "Үргэлжлүүлэх"}
      </PrimaryButton>
    </form>
  );
};

// Хугацаатай багцын автомат сунгалтын мэдээлэл. renewalPackage: идэвхтэй багцын одоогийн
// нөхцөл (багц идэвхгүй болсон бол null тул сунгагдахгүй).
const RenewalNotice = ({ subscription, renewalPackage, balance }) => {
  if (!subscription.expiresAt) return null;
  if (!renewalPackage) {
    return <Message error="Энэ багц идэвхгүй болсон тул хугацаа дуусахад автоматаар сунгагдахгүй." />;
  }
  const price = renewalPackage.basePrice;
  if (balance >= price) {
    return (
      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
        Хугацаа дуусахад хэтэвчнээс {formatMoney(price)} суутгаж автоматаар сунгана. Үлдсэн тоо шилжихгүй.
      </p>
    );
  }
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Хугацаа дуусахад хэтэвчинд {formatMoney(price)} байвал автоматаар сунгана. Одоогийн үлдэгдэл хүрэлцэхгүй байна
      ({formatMoney(price - balance)} дутуу).
    </p>
  );
};

// Идэвхтэй багцын үйлчилгээ бүрийн үлдэгдэл
// onRenew: идэвхтэй багцаа одоо гараар сунгах (багц идэвхгүй болсон бол товч гарахгүй)
const SubscriptionCard = ({ subscription, renewalPackage, balance, awaiting, onRenew }) => {
  if (!subscription) {
    return (
      <Card title="Идэвхтэй багц">
        <Message
          error={
            awaiting
              ? `"${awaiting.packageName}" багцын хугацаа ${formatDate(awaiting.expiresAt)}-нд дууссан. Хэтэвч хүрэлцээгүй тул сунгагдаагүй, үйлчилгээ ашиглах боломжгүй.`
              : "Идэвхтэй багц байхгүй тул үйлчилгээ ашиглах боломжгүй. Доороос багц сонгоно уу."
          }
        />
      </Card>
    );
  }
  return (
    <Card
      title={subscription.packageName}
      description={`${formatDate(subscription.startsAt)}-с ${subscription.expiresAt ? `${formatDate(subscription.expiresAt)} хүртэл` : "хугацаагүй"}`}
    >
      <div className="space-y-4">
        {renewalPackage && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2">
            <p className="text-sm text-gray-600">
              Багцын тоо дууссан эсвэл хугацаанаас өмнө шинэчлэх бол одоо сунгаж болно.
            </p>
            <Button variant="primary" onClick={onRenew}>
              Сунгах
            </Button>
          </div>
        )}
        <RenewalNotice subscription={subscription} renewalPackage={renewalPackage} balance={balance} />
        {subscription.items.map((item) => {
          const service = billableService(item.service);
          const remaining = Math.max(0, item.quota - item.used);
          const hasQuota = includesQuota(subscription.basePrice, item.quota);
          return (
            <div key={item.id} className="space-y-1">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-gray-900">{service?.name ?? item.service}</span>
                <span className="text-gray-600">
                  {hasQuota ? `${item.used} / ${item.quota} ашигласан · ` : ""}
                  {item.carriedOver > 0 && `(+${item.carriedOver} өмнөх багцаас) · `}
                  {hasQuota && item.unitPrice === 0
                    ? "дууссаны дараа ашиглахгүй"
                    : `дууссаны дараа ${formatMoney(item.unitPrice)}/удаа`}
                </span>
              </div>
              {hasQuota ? (
                <>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${remaining ? "bg-blue-600" : "bg-amber-500"}`}
                      style={{ width: `${item.quota ? Math.min(100, (item.used / item.quota) * 100) : 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {remaining
                      ? `${remaining} ${service?.unit ?? ""} үлдсэн`
                      : item.unitPrice > 0
                        ? "Багцын тоо дууссан — цааш хэтэвчнээс задгай үнээр"
                        : "Багцын тоо дууссан — багцаа сунгана уу"}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500">Бүх ашиглалт задгай үнээр хэтэвчнээс</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// Өөрийн промо код ба түүгээр авсан урамшуулал
const ReferralCard = ({ referral }) => (
  <Card
    title="Санал болголт"
    description={
      referral.promo
        ? `Промо кодоо бусад байгууллагад өгөөрэй. Түүгээр бүртгүүлсэн байгууллагын QPay, банкаар төлсөн төлбөр бүрээс ${referral.promo.discount}%, тэдгээрийн урьсан байгууллагын төлбөрөөс ${referral.secondRate}% таны хэтэвчинд орно.`
        : "Танай байгууллагад промо код үүсгээгүй байна. Админд хандана уу."
    }
  >
    {referral.promo && (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 font-mono text-lg font-semibold tracking-wider">
            {referral.promo.code}
          </span>
          <CopyButton text={referral.promo.code} />
        </div>
        <dl className="flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-gray-500">Бүртгүүлсэн байгууллага</dt>
            <dd className="text-lg font-semibold">{referral.referred}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Тэдний урьсан</dt>
            <dd className="text-lg font-semibold">{referral.secondReferred}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Авсан урамшуулал</dt>
            <dd className="text-lg font-semibold text-green-700">{formatMoney(referral.earnedAmount)}</dd>
            {referral.secondEarnedAmount > 0 && (
              <dd className="text-xs text-gray-500">үүнээс 2-р шат {formatMoney(referral.secondEarnedAmount)}</dd>
            )}
          </div>
        </dl>
      </div>
    )}
  </Card>
);

// Улсын нэмэлт жагсаалтууд: үндсэн багц дээр хэтэвчнээс худалдаж авна, идэвхтэй бол сунгана
const AddonsSection = ({ addons, subscription, balance }) => {
  const { errors, success, pending, send } = useSubmit();
  const [busy, setBusy] = useState(null);

  const buy = async (addon) => {
    const action = addon.active ? "сунгах" : "идэвхжүүлэх";
    const message = `${addon.name}-ийг ${addon.durationDays} хоногоор ${action} уу? Хэтэвчнээс ${formatMoney(addon.price)} хасагдана.`;
    if (!window.confirm(message)) return;
    setBusy(addon.key);
    await send("/api/organizations/billing/addons", "POST", { source: addon.key });
    setBusy(null);
  };

  const toggleAutoRenew = async (addon) => {
    const message = addon.autoRenew
      ? `${addon.name}-ийн автомат сунгалтыг зогсоох уу? ${formatDate(addon.expiresAt)} хүртэл ашиглах боломжтой, түүнээс хойш сунгагдахгүй.`
      : `${addon.name}-ийн автомат сунгалтыг сэргээх үү? Хугацаа дуусахад хэтэвчнээс ${formatMoney(addon.price ?? 0)} суутгагдана.`;
    if (!window.confirm(message)) return;
    setBusy(addon.key);
    await send("/api/organizations/billing/addons", "PATCH", { source: addon.key, autoRenew: !addon.autoRenew });
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Улсын нэмэлт жагсаалт</h2>
        <p className="text-sm text-gray-500">
          Үндсэн багцад НҮБ, ЕХ, АНУ, Их Британи, Дэлхийн банкны жагсаалт багтана. Бусад улсын жагсаалтаар тулгах бол энд идэвхжүүлнэ.
          Хугацаа дуусахад хэтэвчнээс автоматаар сунгагдана. Зогсоох бол &quot;Автомат сунгалт зогсоох&quot; дарна.
        </p>
      </div>
      <Message error={errors.form} success={success} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {addons.map((addon) => (
          <Card key={addon.key} className="flex flex-col">
            <div className="flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{addon.name}</h3>
                {addon.active ? (
                  <Badge tone="green">Идэвхтэй</Badge>
                ) : (
                  addon.autoRenew && addon.price != null && <Badge tone="amber">Төлбөр хүлээгдэж байна</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">{addon.description}</p>
              {addon.active && (
                <p className="text-xs text-gray-600">
                  {formatDate(addon.expiresAt)} хүртэл · {addon.autoRenew ? "автоматаар сунгагдана" : "автомат сунгалт зогссон"}
                </p>
              )}
              {!addon.active && addon.autoRenew && addon.price != null && (
                <p className="text-xs text-amber-700">
                  Хугацаа {formatDate(addon.expiresAt)}-нд дууссан. Хэтэвч хүрэлцэхэд автоматаар сунгагдана.
                </p>
              )}
              {addon.expiresAt && (
                <Button variant="link" onClick={() => toggleAutoRenew(addon)} disabled={pending}>
                  {addon.autoRenew ? "Автомат сунгалт зогсоох" : "Автомат сунгалт сэргээх"}
                </Button>
              )}
            </div>
            {addon.price == null ? (
              <p className="text-xs text-gray-500">Одоогоор сунгах боломжгүй</p>
            ) : (
              <>
                <p className="text-xl font-bold">
                  {formatMoney(addon.price)}
                  <span className="text-sm font-normal text-gray-500"> / {addon.durationDays} хоног</span>
                </p>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => buy(addon)}
                  disabled={pending || !subscription || balance < addon.price}
                  title={
                    !subscription
                      ? "Эхлээд үндсэн багц идэвхжүүлнэ үү"
                      : balance < addon.price
                        ? "Хэтэвчний үлдэгдэл хүрэлцэхгүй байна"
                        : undefined
                  }
                >
                  {busy === addon.key ? "Түр хүлээнэ үү..." : addon.active ? "Сунгах" : "Идэвхжүүлэх"}
                </Button>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

// Гадны төлбөрийн (QPay, банк) нэхэмжлэх ба зарлагын баримт: хэвлэх (шинэ цонх) ба имэйлээр
// дахин илгээх. Нэг гүйлгээнд нэг л баримт тул дугаар нь гүйлгээний утга.
const EXTERNAL_METHODS = ["QPAY", "BANK_TRANSFER"];

const PaymentDocuments = ({ payment, send, pending }) => {
  if (!EXTERNAL_METHODS.includes(payment.method)) return null;
  const documents = [
    { type: "invoice", label: "Нэхэмжлэх" },
    ...(payment.status === "PAID" ? [{ type: "receipt", label: "Зарлагын баримт" }] : []),
  ];
  const email = (document) => {
    if (window.confirm(`${document.label} № ${payment.reference}-ийг имэйлээр дахин илгээх үү?`)) {
      send(`/api/organizations/billing/payments/${payment.id}/documents`, "POST", { type: document.type });
    }
  };
  return (
    <div className="space-y-0.5 text-xs">
      {documents.map((document) => (
        <div key={document.type} className="flex items-center gap-2 whitespace-nowrap">
          <a
            href={`/print/payments/${payment.id}?type=${document.type}`}
            target="_blank"
            rel="noopener"
            className="font-medium text-blue-600 hover:underline"
          >
            {document.label}
          </a>
          <button type="button" onClick={() => email(document)} disabled={pending} className="text-gray-500 hover:text-gray-900 disabled:opacity-50">
            ✉ имэйл
          </button>
        </div>
      ))}
    </div>
  );
};

const BillingClient = ({
  balance,
  subscription,
  packages,
  payments,
  transactions,
  bankAccounts,
  qpayEnabled,
  minTopup,
  referral,
  addons,
  awaiting,
}) => {
  // { type: "topup" } | { type: "purchase", pkg } | { type: "payment", id }
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const showPayment = (id) => setModal({ type: "payment", id });
  const documentMail = useSubmit({ refresh: false });
  const payment = modal?.type === "payment" ? payments.find((item) => item.id === modal.id) : null;
  // Идэвхтэй багцын одоогийн нөхцөл (сунгалтад). Багц идэвхгүй болсон бол null.
  const renewalPackage = packages.find((pkg) => pkg.id === subscription?.packageId) ?? null;

  return (
    <div className="space-y-6">
      {awaiting && (
        <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Хэтэвч хүрэлцээгүй тул автомат сунгалт хүлээгдэж байна</p>
          <ul className="list-inside list-disc">
            {awaiting.subscription && (
              <li>
                &quot;{awaiting.subscription.packageName}&quot; багц — {formatMoney(awaiting.subscription.price)}
              </li>
            )}
            {awaiting.addons.map((addon) => (
              <li key={addon.source}>
                {addon.name} — {formatMoney(addon.price)}
              </li>
            ))}
          </ul>
          <p>
            Хэтэвч цэнэглэгдмэгц эхлээд багц, дараа нь нэмэлт жагсаалтууд дарааллаар автоматаар сунгагдаж хэвийн
            ажиллана. Бүгдийг сунгахад {formatMoney(awaiting.total)} шаардлагатай
            {awaiting.total > balance ? `, ${formatMoney(awaiting.total - balance)} дутуу байна` : ""}.
          </p>
          {awaiting.total > balance && (
            <Button variant="primary" onClick={() => setModal({ type: "topup" })}>
              Цэнэглэх
            </Button>
          )}
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <SubscriptionCard
          subscription={subscription}
          renewalPackage={renewalPackage}
          balance={balance}
          awaiting={awaiting?.subscription}
          onRenew={() => setModal({ type: "purchase", pkg: renewalPackage, renew: true })}
        />
        <Card title="Хэтэвч">
          <p className="text-3xl font-bold text-gray-900">{formatMoney(balance)}</p>
          <p className="text-xs text-gray-500">Багцын тоо дууссаны дараах ашиглалт, багцын суурь үнийг эндээс төлж болно.</p>
          <Button variant="primary" className="w-full" onClick={() => setModal({ type: "topup" })}>
            Цэнэглэх
          </Button>
        </Card>
      </div>

      <ReferralCard referral={referral} />

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Багцууд</h2>
        {packages.length === 0 ? (
          <EmptyState>Одоогоор багц байхгүй байна</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <Card key={pkg.id} className="flex flex-col">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold">{pkg.name}</h3>
                    {subscription?.packageId === pkg.id && <Badge tone="green">Идэвхтэй</Badge>}
                  </div>
                  {pkg.description && <p className="text-sm text-gray-500">{pkg.description}</p>}
                </div>
                <p className="text-2xl font-bold">
                  {formatMoney(pkg.basePrice)}
                  <span className="text-sm font-normal text-gray-500">
                    {pkg.durationDays ? ` / ${pkg.durationDays} хоног` : ""}
                  </span>
                </p>
                <div className="flex-1">
                  <PackageItems pkg={pkg} />
                </div>
                {pkg.id === renewalPackage?.id ? (
                  <Button variant="secondary" className="w-full" onClick={() => setModal({ type: "purchase", pkg, renew: true })}>
                    Сунгах
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" onClick={() => setModal({ type: "purchase", pkg })}>
                    {pkg.basePrice === 0 ? "Идэвхжүүлэх" : "Худалдаж авах"}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {addons.length > 0 && <AddonsSection addons={addons} subscription={subscription} balance={balance} />}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Төлбөрүүд</h2>
          <Message error={documentMail.errors.form} success={documentMail.success} />
          {payments.length === 0 ? (
            <EmptyState>Төлбөр байхгүй</EmptyState>
          ) : (
            <Table headers={["Огноо", "Зориулалт", "Дүн", "Төлөв", ""]}>
              {payments.map((item) => (
                <tr key={item.id}>
                  <Cell className="whitespace-nowrap text-gray-600">
                    {formatDateTime(item.createdAt)}
                    <p className="text-xs text-gray-400">{personName(item.createdBy)}</p>
                  </Cell>
                  <Cell>
                    {paymentPurpose(item)}
                    <p className="text-xs text-gray-500">{PAYMENT_METHODS[item.method]}</p>
                  </Cell>
                  <Cell className="whitespace-nowrap font-medium">{formatMoney(item.amount)}</Cell>
                  <Cell>
                    <StatusBadge status={item.status} statuses={PAYMENT_STATUSES} />
                    {item.adminNote && <p className="mt-1 max-w-xs text-xs text-gray-500">{item.adminNote}</p>}
                  </Cell>
                  <Cell className="space-y-1">
                    {item.status === "PENDING" && (
                      <Button variant="link" onClick={() => showPayment(item.id)}>
                        Төлөх
                      </Button>
                    )}
                    <PaymentDocuments payment={item} send={documentMail.send} pending={documentMail.pending} />
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Хэтэвчний гүйлгээ</h2>
          {transactions.length === 0 ? (
            <EmptyState>Гүйлгээ байхгүй</EmptyState>
          ) : (
            <Table headers={["Огноо", "Гүйлгээ", "Дүн", "Үлдэгдэл"]}>
              {transactions.map((item) => (
                <tr key={item.id}>
                  <Cell className="whitespace-nowrap text-gray-600">{formatDateTime(item.createdAt)}</Cell>
                  <Cell>
                    {WALLET_TRANSACTION_TYPES[item.type]}
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </Cell>
                  <Cell className={`whitespace-nowrap font-medium ${item.amount > 0 ? "text-green-700" : "text-red-600"}`}>
                    {item.amount > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(item.amount))}
                  </Cell>
                  <Cell className="whitespace-nowrap text-gray-600">{formatMoney(item.balanceAfter)}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      <Modal open={modal?.type === "topup"} onClose={close} title="Хэтэвч цэнэглэх">
        <TopupForm
          qpayEnabled={qpayEnabled}
          minTopup={minTopup}
          suggested={awaiting ? awaiting.total - balance : 0}
          onPayment={showPayment}
          onDone={close}
        />
      </Modal>
      <Modal
        open={modal?.type === "purchase"}
        onClose={close}
        title={modal?.pkg ? `"${modal.pkg.name}" багц${modal.renew ? " сунгах" : ""}` : ""}
      >
        {modal?.pkg && (
          <PurchaseForm
            pkg={modal.pkg}
            current={subscription}
            renew={modal.renew}
            balance={balance}
            qpayEnabled={qpayEnabled}
            onPayment={showPayment}
            onDone={close}
          />
        )}
      </Modal>
      <Modal open={Boolean(payment)} onClose={close} title="Төлбөр төлөх" className="max-w-2xl">
        {payment && <PaymentInstructions payment={payment} bankAccounts={bankAccounts} onClose={close} />}
      </Modal>
    </div>
  );
};

export default BillingClient;
