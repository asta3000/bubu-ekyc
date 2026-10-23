"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Checkbox, FieldError, Input, Select } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { withOverageConfirm } from "@/lib/billing/client";
import { sendJson } from "@/lib/fetcher";
import { SUBJECT_LABELS } from "./labels";
import MatchResults from "./match-results";

const SUBJECT_OPTIONS = Object.entries(SUBJECT_LABELS).map(([value, label]) => ({ value, label }));
const THRESHOLD_VALUES = [70, 75, 80, 85, 90, 95];

// Админы тохируулсан анхны босго жагсаалтад байхгүй бол нэмнэ
const thresholdOptions = (defaultThreshold) =>
  [...new Set([...THRESHOLD_VALUES, defaultThreshold])].sort((a, b) => a - b).map((value) => ({ value, label: `${value}%` }));

// Жагсаалтын нэрний доорх тайлбар: бичлэгийн тоо, сүүлд шинэчлэгдсэн огноо
const sourceDescription = ({ count, updatedAt }) =>
  updatedAt
    ? `${count.toLocaleString("en-US")} бичлэг · ${updatedAt}-нд шинэчлэгдсэн`
    : "Импортлогдоогүй";

// Харилцагчийн мэдээллээр хоригийн жагсаалттай тулгана.
// countries: [{ value, label }], sources: [{ key, name, count, updatedAt }],
// defaults: URL-аас ирсэн анхны утга { name, birthDate, subjectType }
// defaultThreshold: админы онооны тохиргооны анхны босго
const MatchForm = ({ countries, sources, defaults = {}, defaultThreshold = 85 }) => {
  const router = useRouter();
  const [subjectType, setSubjectType] = useState(defaults.subjectType ?? "INDIVIDUAL");
  const [state, setState] = useState({ errors: {} });
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = { ...Object.fromEntries(form), sources: form.getAll("sources") };

    setPending(true);
    const result = await withOverageConfirm((payOverage) =>
      sendJson("/api/organizations/match", "POST", { ...data, payOverage }),
    );
    setState(result.ok ? { errors: {}, results: result.results, screeningId: result.id } : { errors: result.errors });
    setPending(false);
    // Доорх түүхэнд шинэ шалгалт нэмэгдэнэ
    if (result.ok) router.refresh();
  };

  const isIndividual = subjectType === "INDIVIDUAL";

  return (
    <div className="space-y-6">
      <Card
        title="Харилцагчийг тулгах"
        description="Нэр заавал. Төрсөн огноо, улс, бичиг баримтын дугаар оруулбал тохирлыг нарийвчилж, хуурамч тохирлыг багасгана."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Message error={state.errors.form} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Төрөл"
              name="subjectType"
              value={subjectType}
              onChange={(event) => setSubjectType(event.target.value)}
              placeholder="Бүгд"
              options={SUBJECT_OPTIONS}
              error={state.errors.subjectType}
            />
            <div className="md:col-span-1 xl:col-span-3">
              <Input
                label={isIndividual ? "Овог, нэр" : "Нэр"}
                name="name"
                defaultValue={defaults.name}
                placeholder={isIndividual ? "Жишээ: Bat-Erdene Dorj, Батын Дорж" : "Жишээ: Golden Gobi LLC"}
                maxLength={200}
                error={state.errors.name}
                autoFocus
                required
              />
            </div>
            {/* Жагсаалтууд зөвхөн хувь хүний төрсөн огноог агуулдаг */}
            <Input
              label="Төрсөн он / огноо"
              name="birthDate"
              defaultValue={defaults.birthDate}
              placeholder="1975 эсвэл 1975-03-21"
              maxLength={10}
              error={state.errors.birthDate}
              disabled={Boolean(subjectType) && !isIndividual}
            />
            <Select
              label={isIndividual ? "Иргэншил / оршин суугаа улс" : "Бүртгэлтэй улс"}
              name="country"
              defaultValue=""
              placeholder="Сонгоогүй"
              options={countries}
              error={state.errors.country}
            />
            <Input
              label={subjectType === "VESSEL" ? "IMO дугаар" : "Бичиг баримтын дугаар"}
              name="identifier"
              placeholder={isIndividual ? "Паспорт, регистр" : "Регистр, IMO, татварын дугаар"}
              maxLength={100}
              error={state.errors.identifier}
            />
            <Select
              label="Тохирлын босго"
              name="threshold"
              defaultValue={String(defaultThreshold)}
              options={thresholdOptions(defaultThreshold)}
              error={state.errors.threshold}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Жагсаалтууд</legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => (
                <Checkbox
                  key={source.key}
                  name="sources"
                  value={source.key}
                  label={source.name}
                  description={sourceDescription(source)}
                  defaultChecked={source.count > 0}
                  disabled={source.count === 0}
                />
              ))}
            </div>
            <FieldError error={state.errors.sources} />
          </fieldset>

          <div className="flex justify-end">
            <div className="w-40">
              <PrimaryButton pending={pending} pendingText="Тулгаж байна...">
                Тулгах
              </PrimaryButton>
            </div>
          </div>
        </form>
      </Card>

      {state.results && <MatchResults results={state.results} screeningId={state.screeningId} />}
    </div>
  );
};

export default MatchForm;
