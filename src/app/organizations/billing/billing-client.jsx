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
import { billableService } from "@/lib/billing/services";
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
const TopupForm = ({ qpayEnabled, minTopup, onPayment, onDone }) => {
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
        defaultValue={minTopup}
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
            {pkg.basePrice > 0 && `${item.quota} ${service?.unit ?? ""} · `}
            {formatMoney(item.unitPrice)}/удаа
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

// current: одоогийн идэвхтэй багц (үлдэгдэл шилжих эсэхийг тайлбарлахад)
const PurchaseForm = ({ pkg, current, balance, qpayEnabled, onPayment, onDone }) => {
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
          (pkg.basePrice >= current.basePrice
            ? `"${current.packageName}" багцын үлдсэн тоо шинэ багцад нэмэгдэнэ. `
            : `Шинэ багц идэвхжихэд "${current.packageName}" багц дуусч, үлдсэн тоо шилжихгүй. `)}
        {pkg.basePrice === 0 && "Суурь үнэгүй тул ашиглах бүрт задгай үнийг хэтэвчнээс төлнө."}
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
      <PrimaryButton pending={pending}>{free || method === "WALLET" ? "Идэвхжүүлэх" : "Үргэлжлүүлэх"}</PrimaryButton>
    </form>
  );
};

// Идэвхтэй багцын үйлчилгээ бүрийн үлдэгдэл
const SubscriptionCard = ({ subscription }) => {
  if (!subscription) {
    return (
      <Card title="Идэвхтэй багц">
        <Message error="Идэвхтэй багц байхгүй тул үйлчилгээ ашиглах боломжгүй. Доороос багц сонгоно уу." />
      </Card>
    );
  }
  const includesQuota = subscription.basePrice > 0;
  return (
    <Card
      title={subscription.packageName}
      description={`${formatDate(subscription.startsAt)}-с ${subscription.expiresAt ? `${formatDate(subscription.expiresAt)} хүртэл` : "хугацаагүй"}`}
    >
      <div className="space-y-4">
        {subscription.items.map((item) => {
          const service = billableService(item.service);
          const remaining = Math.max(0, item.quota - item.used);
          return (
            <div key={item.id} className="space-y-1">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-gray-900">{service?.name ?? item.service}</span>
                <span className="text-gray-600">
                  {includesQuota ? `${item.used} / ${item.quota} ашигласан · ` : ""}
                  {item.carriedOver > 0 && `(+${item.carriedOver} өмнөх багцаас) · `}
                  дууссаны дараа {formatMoney(item.unitPrice)}/удаа
                </span>
              </div>
              {includesQuota ? (
                <>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${remaining ? "bg-blue-600" : "bg-amber-500"}`}
                      style={{ width: `${item.quota ? Math.min(100, (item.used / item.quota) * 100) : 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {remaining ? `${remaining} ${service?.unit ?? ""} үлдсэн` : "Багцын тоо дууссан — цааш хэтэвчнээс задгай үнээр"}
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
        ? `Промо кодоо бусад байгууллагад өгөөрэй. Түүгээр бүртгүүлсэн байгууллагын QPay, банкаар төлсөн төлбөр бүрээс ${referral.promo.discount}% таны хэтэвчинд орно.`
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
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-gray-500">Бүртгүүлсэн байгууллага</dt>
            <dd className="text-lg font-semibold">{referral.referred}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Авсан урамшуулал</dt>
            <dd className="text-lg font-semibold text-green-700">{formatMoney(referral.earnedAmount)}</dd>
          </div>
        </dl>
      </div>
    )}
  </Card>
);

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
}) => {
  // { type: "topup" } | { type: "purchase", pkg } | { type: "payment", id }
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const showPayment = (id) => setModal({ type: "payment", id });
  const payment = modal?.type === "payment" ? payments.find((item) => item.id === modal.id) : null;

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <SubscriptionCard subscription={subscription} />
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
                <Button variant="secondary" className="w-full" onClick={() => setModal({ type: "purchase", pkg })}>
                  {pkg.basePrice === 0 ? "Идэвхжүүлэх" : "Худалдаж авах"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Төлбөрүүд</h2>
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
                  <Cell>
                    {item.status === "PENDING" && (
                      <Button variant="link" onClick={() => showPayment(item.id)}>
                        Төлөх
                      </Button>
                    )}
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
        <TopupForm qpayEnabled={qpayEnabled} minTopup={minTopup} onPayment={showPayment} onDone={close} />
      </Modal>
      <Modal open={modal?.type === "purchase"} onClose={close} title={modal?.pkg ? `"${modal.pkg.name}" багц` : ""}>
        {modal?.pkg && (
          <PurchaseForm pkg={modal.pkg} current={subscription} balance={balance} qpayEnabled={qpayEnabled} onPayment={showPayment} onDone={close} />
        )}
      </Modal>
      <Modal open={Boolean(payment)} onClose={close} title="Төлбөр төлөх" className="max-w-2xl">
        {payment && <PaymentInstructions payment={payment} bankAccounts={bankAccounts} onClose={close} />}
      </Modal>
    </div>
  );
};

export default BillingClient;
