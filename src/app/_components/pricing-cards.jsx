"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/Links";
import { BILLABLE_SERVICES, annualTerms, includesQuota } from "@/lib/billing/services";
import { formatMoney } from "@/lib/format";

const Check = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-teal-500" aria-hidden="true">
    <path fill="currentColor" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
  </svg>
);

// Багцад ороогүй үйлчилгээ
const Cross = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true">
    <path fill="currentColor" d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
  </svg>
);

const PERIODS = [
  { value: "month", label: "Сараар" },
  { value: "year", label: "Жилээр" },
];

// Вэбсайтын багцууд: сараар (багцын өөрийн нөхцөл) эсвэл жилээр (админы тохиргоогоор
// хөнгөлсөн жилийн үнэ, тоо нь сар бүр шинэчлэгдэнэ) харуулна. annual: { discountRate, durationDays }
const PricingCards = ({ packages, annual }) => {
  const [period, setPeriod] = useState("month");

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-2">
        <div className="inline-grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200" role="tablist" aria-label="Төлбөрийн хугацаа">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={period === item.value}
              onClick={() => setPeriod(item.value)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
                period === item.value ? "bg-teal-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {annual.discountRate > 0 && (
          <p className="text-sm font-medium text-teal-700">Жилээр авбал {annual.discountRate}% хэмнэнэ</p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        {packages.map((pkg) => {
          const terms = period === "year" ? annualTerms(pkg, annual) : null;
          return (
            <div
              key={pkg.id}
              className="flex w-full flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-teal-300 hover:shadow-md sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">{pkg.name}</h3>
                {pkg.description && <p className="text-sm text-slate-600">{pkg.description}</p>}
              </div>
              <div className="space-y-1">
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-slate-900">
                    {formatMoney(terms ? terms.price : pkg.basePrice)}
                  </span>
                  {terms ? (
                    <span className="text-sm text-slate-500">/ жил</span>
                  ) : (
                    pkg.durationDays && <span className="text-sm text-slate-500">/ {pkg.durationDays} хоног</span>
                  )}
                </p>
                {terms && terms.saving > 0 && (
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-400 line-through">{formatMoney(terms.fullPrice)}</span>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                      {formatMoney(terms.saving)} хэмнэнэ
                    </span>
                  </p>
                )}
                {terms && (
                  <p className="text-xs text-slate-500">
                    Сард {formatMoney(Math.round(terms.price / terms.periods))} · {terms.durationDays} хоног
                  </p>
                )}
                {period === "year" && !terms && <p className="text-xs text-slate-500">Энэ багцыг сараар санал болгодог.</p>}
              </div>
              <ul className="flex-1 space-y-3 text-sm text-slate-700">
                {/* Бүх үйлчилгээг харуулна: багцад орсон нь ✓, ороогүй нь ✕ */}
                {BILLABLE_SERVICES.map((service) => {
                  const item = pkg.items.find((row) => row.service === service.key);
                  if (!item) {
                    return (
                      <li key={service.key} className="flex gap-2 text-slate-400">
                        <Cross />
                        <span>
                          <span className="font-medium">{service.name}</span>
                          <span className="block">Багцад ороогүй</span>
                        </span>
                      </li>
                    );
                  }
                  const quota = includesQuota(pkg.basePrice, item.quota);
                  return (
                    <li key={service.key} className="flex gap-2">
                      <Check />
                      <span>
                        <span className="font-medium text-slate-900">{service.name}</span>
                        <span className="block text-slate-500">
                          {quota && `${item.quota.toLocaleString("en-US")} ${service.unit}${terms ? " сар бүр" : ""} багтсан · `}
                          {quota
                            ? item.unitPrice > 0
                              ? `дараа нь ${formatMoney(item.unitPrice)}/удаа`
                              : "дараа нь ашиглахгүй"
                            : `${formatMoney(item.unitPrice)}/удаа`}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {pkg.basePrice === 0 && (
                  <li className="text-xs text-slate-500">
                    {pkg.items.some((item) => item.quota > 0)
                      ? "Суурь үнэ 0₮, багцын тоо дууссаны дараа задгай үнээр төлнө."
                      : "Суурь үнэ 0₮, ашиглах бүрт задгай үнээр төлнө."}
                  </li>
                )}
              </ul>
              <ButtonLink href="/register" variant="primary" className="text-center">
                Эхлэх
              </ButtonLink>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PricingCards;
