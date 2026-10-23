"use client";

import { useState } from "react";
import { Button } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Message } from "@/components/Messages";
import { sendJson } from "@/lib/fetcher";
import { sanctionSource } from "@/lib/sanctions/sources";
import { Badge, toneClass } from "@/components/Badges";
import { CHECK_LABELS, SUBJECT_LABELS, scoreLevel } from "./labels";

const CheckBadge = ({ label, value }) => {
  if (!value) return null;
  const check = CHECK_LABELS[value];
  return (
    <Badge tone={check.tone}>
      {label}: {check.label}
    </Badge>
  );
};

const ScoreBadge = ({ score }) => {
  const level = scoreLevel(score);
  return (
    <span className={`inline-flex flex-col items-center rounded-lg px-3 py-1 ${toneClass(level.tone, true)}`}>
      <span className="text-lg font-bold leading-none">{score}</span>
      <span className="text-[10px] uppercase">{level.label}</span>
    </span>
  );
};

const DetailRow = ({ label, values }) => {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  if (!list.length) return null;
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="space-y-0.5 text-gray-900">
        {list.map((value, index) => (
          <p key={index} className="break-words">
            {value}
          </p>
        ))}
      </dd>
    </div>
  );
};

// Тохирлыг хэвлэх товч ба хэвлэлтийн түүх (баримтын дугаар, хэн, хэзээ). prints: [{ id, number, by, at }]
const PrintSection = ({ screeningId, index, prints: initialPrints }) => {
  const [prints, setPrints] = useState(initialPrints);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const print = async () => {
    // Popup blocker-оос сэргийлж цонхыг товч дарсан даруйд нээгээд, дараа нь хаягийг өгнө
    const win = window.open("about:blank", "_blank");
    setPending(true);
    const result = await sendJson(`/api/organizations/match/${screeningId}/prints`, "POST", { index });
    setPending(false);
    if (!result.ok) {
      win?.close();
      setError(result.errors.form ?? result.errors.index);
      return;
    }
    setError(null);
    setPrints((current) => [result.print, ...current]);
    const url = `/print/screenings/${result.print.id}`;
    if (win) win.location.href = url;
    else window.location.href = url;
  };

  return (
    <div className="space-y-2 border-t border-gray-200 pt-3">
      <Message error={error} />
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="primary" onClick={print} disabled={pending}>
          {pending ? "Бэлтгэж байна..." : "Хэвлэх"}
        </Button>
        <div className="min-w-0 flex-1 text-xs text-gray-500">
          {prints.length === 0 ? (
            <p className="py-2">Хэвлэж байгаагүй</p>
          ) : (
            <ul className="space-y-0.5">
              <li className="font-medium text-gray-700">Хэвлэлтийн түүх</li>
              {prints.map((item) => (
                <li key={item.id}>
                  {item.number && <span className="font-mono text-gray-700">№{item.number} · </span>}
                  {item.at} · {item.by}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// Нэг тохирол: оноо, аль нэртэй таарсан, шалгуур тус бүрийн үр дүн, дэлгэрэнгүй, хэвлэх
const MatchItem = ({ match, index, screeningId, prints }) => {
  const [open, setOpen] = useState(false);
  const { entry, checks } = match;

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start gap-4">
        <ScoreBadge score={match.score} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-gray-900">{entry.name}</p>
          {match.matchedName && match.matchedName !== entry.name && (
            <p className="text-sm text-gray-500">Таарсан нэр: {match.matchedName}</p>
          )}
          <p className="text-xs text-gray-500">
            {sanctionSource(entry.source)?.name ?? entry.source} · {SUBJECT_LABELS[entry.subjectType]} ·
            Нэрийн тохирол {match.nameScore}%
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            <CheckBadge label="Төрсөн огноо" value={checks.birthDate} />
            <CheckBadge label="Улс" value={checks.country} />
            <CheckBadge label="Дугаар" value={checks.identifier} />
          </div>
        </div>
        <Button variant="link" onClick={() => setOpen((value) => !value)}>
          {open ? "Хураах" : "Дэлгэрэнгүй"}
        </Button>
      </div>
      {open && (
        <div className="space-y-3 rounded-lg bg-gray-50 p-3 text-sm">
          <dl className="space-y-2">
            <DetailRow label="Өөр нэрс" values={entry.aliases} />
            <DetailRow label="Төрсөн огноо" values={entry.birthDates} />
            <DetailRow label="Төрсөн газар" values={entry.birthPlaces} />
            <DetailRow label="Иргэншил" values={entry.nationalities} />
            <DetailRow label="Хаяг" values={entry.addresses} />
            <DetailRow label="Бичиг баримт" values={entry.identifiers} />
            <DetailRow label="Хөтөлбөр" values={entry.programs} />
            <DetailRow label="Жагсаалтад орсон" values={entry.listedAt?.slice(0, 10)} />
            <DetailRow label="Дугаар" values={entry.externalId} />
            <DetailRow label="Тайлбар" values={entry.remarks} />
          </dl>
          {screeningId && <PrintSection screeningId={screeningId} index={index} prints={prints} />}
        </div>
      )}
    </li>
  );
};

// screeningId өгвөл тохирол бүрийг хэвлэх боломжтой. prints: { [тохирлын дугаар]: [{ id, number, by, at }] }
const MatchResults = ({ results, screeningId, prints = {} }) => (
  <Card
    title={results.length ? `${results.length} тохирол олдлоо` : "Тохирол олдсонгүй"}
    description={
      results.length
        ? "Оноо өндөр тохирлыг бусад мэдээллээр (төрсөн огноо, улс, бичиг баримт) нягтлан шалгана уу."
        : "Сонгосон жагсаалтуудад тохирох этгээд илэрсэнгүй."
    }
  >
    {results.length > 0 && (
      <ul className="-mx-6 divide-y divide-gray-100 border-t border-gray-100">
        {results.map((match, index) => (
          <MatchItem
            key={`${match.entry.source}:${match.entry.externalId}`}
            match={match}
            index={index}
            screeningId={screeningId}
            prints={prints[index] ?? []}
          />
        ))}
      </ul>
    )}
  </Card>
);

export default MatchResults;
