"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Checkbox } from "@/components/Inputs";
import { Markdown } from "@/components/Markdown";
import { Message } from "@/components/Messages";
import { formatDateTime } from "@/lib/format";
import { useSubmit } from "@/lib/use-submit";

// Форматын товч заавар
const SYNTAX = [
  ["## Гарчиг", "бүлгийн гарчиг"],
  ["### Дэд гарчиг", "жижиг гарчиг"],
  ["**тод**", "тод үг"],
  ["- зүйл", "цэгтэй жагсаалт"],
  ["1. алхам", "дугаартай жагсаалт"],
  ["> Жишээ: ...", "цэнхэр хайрцаг"],
  ["| A | B |", "хүснэгтийн мөр"],
];

const ContentEditor = ({ docKey, title, path, versioned, markdown, version, updatedAt }) => {
  const [text, setText] = useState(markdown);
  const [view, setView] = useState("edit");
  const [bump, setBump] = useState(false);
  const { errors, success, pending, submit } = useSubmit();
  const changed = text !== markdown;

  const save = async (event) => {
    event.preventDefault();
    if (bump && !window.confirm("Шинэ хувилбар болгох уу? Байгууллагын бүх хэрэглэгчээс нөхцлийг дахин зөвшөөрүүлнэ.")) return;
    if (await submit(`/api/managements/content/${docKey}`, "PUT", { markdown: text, newVersion: bump })) setBump(false);
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_16rem]">
      <Card className="w-full">
        <form onSubmit={save} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
              {[
                ["edit", "Засах"],
                ["preview", "Урьдчилан харах"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={`rounded-md px-3 py-1 font-medium ${view === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <a href={path} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Нийтийн хуудсыг нээх ↗
            </a>
          </div>
          <Message error={errors.form ?? errors.markdown} success={success} />
          {view === "edit" ? (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-label={title}
              spellCheck={false}
              className="h-[65vh] w-full resize-y rounded-lg border border-gray-300 p-3 font-mono text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <div className="h-[65vh] overflow-y-auto rounded-lg border border-gray-200 p-6">
              <Markdown source={text} />
            </div>
          )}
          {versioned && (
            <Checkbox
              label="Шинэ хувилбар болгох (хэрэглэгчдээс дахин зөвшөөрөл авна)"
              description="Агуулгын өөрчлөлт (шинэ дүрэм, хугацаа, нөхцөл) хийсэн үед сонгоно. Үсгийн алдаа засахад сонгохгүй."
              checked={bump}
              onChange={(event) => setBump(event.target.checked)}
            />
          )}
          <div className="flex items-center justify-end gap-3">
            {changed && <span className="text-sm text-amber-600">Хадгалаагүй өөрчлөлттэй</span>}
            <PrimaryButton pending={pending} disabled={pending || (!changed && !bump)} className="w-auto">
              Хадгалах
            </PrimaryButton>
          </div>
        </form>
      </Card>
      <div className="space-y-4">
        <Card title="Мэдээлэл">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Сүүлд хадгалсан</dt>
              <dd className="text-gray-900">{updatedAt ? formatDateTime(updatedAt) : "Анхны агуулга (засаагүй)"}</dd>
            </div>
            {versioned && (
              <div>
                <dt className="text-gray-500">Хувилбар</dt>
                <dd className="font-mono text-gray-900">{version ?? "—"}</dd>
              </div>
            )}
          </dl>
        </Card>
        <Card title="Формат">
          <dl className="space-y-1.5 text-sm">
            {SYNTAX.map(([code, label]) => (
              <div key={code} className="flex items-baseline justify-between gap-2">
                <dt>
                  <code className="rounded bg-gray-100 px-1 text-xs">{code}</code>
                </dt>
                <dd className="text-right text-gray-500">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-gray-500">Догол мөр хооронд нэг хоосон мөр үлдээнэ.</p>
        </Card>
      </div>
    </div>
  );
};

export default ContentEditor;
