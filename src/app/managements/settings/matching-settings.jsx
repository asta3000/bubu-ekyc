"use client";

import { useState } from "react";
import { Button, PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input, Textarea } from "@/components/Inputs";
import { Message } from "@/components/Messages";
import { useSubmit } from "@/lib/use-submit";
import { DEFAULT_MATCHING, MATCHING_FIELDS } from "@/lib/screening/config";

// Онооны тооцооны тайлбар (одоогийн утгуудтайгаар)
const Explanation = ({ config }) => (
  <Card title="Тохирлын хувь хэрхэн бодогддог вэ">
    <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
      <li>
        <b>Нэрийг бэлтгэнэ.</b> Кирилл үсгийг латин болгож (х → kh, h хоёр хувилбар), том жижиг үсэг, тэмдэгт,
        диакритикийг арилгаад үгсэд хуваана. LLC, ХХК зэрэг утгагүй үгсийг хасна. Жагсаалтын этгээдийн үндсэн нэр
        болон бүх өөр нэртэй харьцуулж, хамгийн өндөр оноог авна.
      </li>
      <li>
        <b>Үг бүрийг тулгана.</b> Хайсан нэрийн үг бүрт жагсаалтын нэрээс хамгийн төстэй үгийг Jaro-Winkler аргаар
        (0-1) олно. Төстэй байдал <b>{config.tokenMatch}</b>-аас бага бол <b>×{config.tokenPenalty}</b> болгож
        бараг тохироогүйд тооцно.
      </li>
      <li>
        <b>Үгийн оноо</b> = хайсан нэрийн үгсийн дундаж × <b>{config.queryWeight}</b> + жагсаалтын нэрийн үгсийн
        дундаж × <b>{(1 - config.queryWeight).toFixed(2)}</b>. Үгсийн дараалал хамаарахгүй.
      </li>
      <li>
        <b>Нийлсэн үгийн оноо.</b> Үгийн тоо зөрүүтэй, урт нь <b>{config.joinedMinRatio}</b>-аас ойролцоо бол
        үгсийг зайгүй нийлүүлж ("Abdulrahman" = "Abdul Rahman") харьцуулаад <b>×{config.joinedWeight}</b>.
      </li>
      <li>
        <b>Нэрийн оноо</b> = үгийн ба нийлсэн үгийн онооны их нь × 100. Бүрэн ижил бол 100.
      </li>
      <li>
        <b>Нэмэх/хасах:</b> төрсөн огноо таарвал +{config.dobExact}, он таарвал +{config.dobYear}, зөрвөл{" "}
        {config.dobMismatch}; улс таарвал +{config.countryMatch}, зөрвөл {config.countryMismatch}. Мэдээлэлгүй бол
        0. Бичиг баримтын дугаар таарвал нэрээс үл хамааран <b>100</b>. Эцсийн оноо 0-100 хооронд.
      </li>
      <li>Эцсийн оноо тулгах үеийн босгоос (анхдагч {config.defaultThreshold}%) их буюу тэнцүү бол тохирол гэж харуулна.</li>
    </ol>
  </Card>
);

const percent = (value) => `${Math.round(value * 100)}%`;

const TokenTable = ({ title, pairs }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-gray-500">{title}</p>
    <table className="w-full text-xs">
      <tbody className="divide-y divide-gray-100">
        {pairs.map((pair, index) => (
          <tr key={index}>
            <td className="py-1 font-mono">{pair.token}</td>
            <td className="py-1 text-gray-400">→</td>
            <td className="py-1 font-mono">{pair.best ?? "—"}</td>
            <td className="py-1 text-right text-gray-500">{percent(pair.similarity)}</td>
            <td className={`py-1 text-right font-medium ${pair.score < pair.similarity ? "text-red-600" : ""}`}>
              {percent(pair.score)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Хоёр нэрийн оноог form дээрх (хадгалаагүй) утгуудаар тооцож задаргааг харуулна
const ScoreTester = ({ config }) => {
  const [result, setResult] = useState(null);
  // Тооцоолол тул хуудсыг дахин уншихгүй
  const { errors, pending, send } = useSubmit({ refresh: false });

  const test = async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const response = await send("/api/managements/settings/matching/test", "POST", { ...form, config });
    setResult(response.ok ? response : null);
  };
  return (
    <Card title="Турших" description="Хоёр нэрийн нэрийн оноог дээрх (хадгалаагүй ч) утгуудаар тооцно.">
      <form onSubmit={test} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Хайсан нэр" name="query" placeholder="Али Хаменеи" required />
          <Input label="Жагсаалтын нэр" name="candidate" placeholder="KHAMENEI, Ali Husseini" required />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Тооцож байна..." : "Тооцоолох"}
        </Button>
      </form>
      <Message error={errors.form ?? Object.values(errors)[0]} />
      {result && (
        <div className="space-y-3 rounded-lg bg-gray-50 p-3 text-sm">
          <p>
            Нэрийн оноо: <b className="text-lg">{result.score}</b>{" "}
            <span className="text-gray-500">
              ({{ exact: "бүрэн ижил", joined: "нийлсэн үгээр", tokens: "үгээр", empty: "үг олдсонгүй" }[result.method]})
            </span>
          </p>
          <p className="text-xs text-gray-500">
            Бэлтгэсэн нэр: <span className="font-mono">{result.query.tokens.join(" ")}</span> ↔{" "}
            <span className="font-mono">{result.candidate.tokens.join(" ")}</span>
          </p>
          {result.forward && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TokenTable title={`Хайсан нэрийн үгс (жин ${config.queryWeight})`} pairs={result.forward} />
                <TokenTable
                  title={`Жагсаалтын нэрийн үгс (жин ${(1 - config.queryWeight).toFixed(2)})`}
                  pairs={result.backward}
                />
              </div>
              <p className="text-xs text-gray-600">
                Үгийн оноо {percent(result.byTokens)} · Нийлсэн үгийн оноо{" "}
                {result.joined.applies
                  ? percent(result.joined.score)
                  : `хэрэглэгдээгүй (үгийн тоо ижил эсвэл уртын харьцаа ${result.joined.lengthRatio.toFixed(2)})`}
                . Улаан нь босгоос бага тул ×{config.tokenPenalty} болсон.
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

// Онооны тохиргоо: тайлбар, утгууд, турших хэрэгсэл. initial: хадгалсан (эсвэл анхны) утгууд
const MatchingSettings = ({ initial }) => {
  const [config, setConfig] = useState(initial);
  const [stopWords, setStopWords] = useState(initial.stopWords.join(", "));
  const { errors, success, pending, send, submit } = useSubmit();

  const update = (key) => (event) => setConfig((current) => ({ ...current, [key]: Number(event.target.value) }));
  const payload = { ...config, stopWords };

  const save = (event) => {
    event.preventDefault();
    submit("/api/managements/settings/matching", "PUT", payload);
  };

  const reset = async () => {
    if (!window.confirm("Онооны тохиргоог анхны утгад буцаах уу?")) return;
    if (!(await send("/api/managements/settings/matching", "DELETE")).ok) return;
    setConfig(DEFAULT_MATCHING);
    setStopWords(DEFAULT_MATCHING.stopWords.join(", "));
  };

  return (
    <div className="space-y-6">
      <Explanation config={config} />
      <Card title="Онооны тохиргоо" description="Хадгалсны дараа шинэ тулгалтад үйлчилнэ. Өмнөх тулгалтын үр дүн өөрчлөгдөхгүй.">
        <form onSubmit={save} className="space-y-5">
          <Message error={errors.form} success={success} />
          {MATCHING_FIELDS.map((group) => (
            <fieldset key={group.group} className="space-y-3">
              <legend className="text-sm font-semibold text-gray-900">{group.group}</legend>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Input
                      label={`${field.label} (анх ${DEFAULT_MATCHING[field.key]})`}
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={config[field.key]}
                      onChange={update(field.key)}
                      error={errors[field.key]}
                      required
                    />
                    {field.hint && <p className="text-xs text-gray-500">{field.hint}</p>}
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
          <Textarea
            label="Нэрнээс хасах утгагүй үгс (таслалаар)"
            rows={3}
            value={stopWords}
            onChange={(event) => setStopWords(event.target.value)}
            error={errors.stopWords}
          />
          <div className="flex flex-wrap gap-2">
            <div className="w-40">
              <PrimaryButton pending={pending}>Хадгалах</PrimaryButton>
            </div>
            <Button onClick={reset} disabled={pending}>
              Анхны утгад буцаах
            </Button>
          </div>
        </form>
      </Card>
      <ScoreTester config={payload} />
    </div>
  );
};

export default MatchingSettings;
