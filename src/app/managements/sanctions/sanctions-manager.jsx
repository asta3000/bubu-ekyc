"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/Badges";
import { Button } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { EmptyState } from "@/components/Messages";
import { Cell, Table } from "@/components/Tables";
import { sendJson } from "@/lib/fetcher";
import { personName } from "@/lib/format";
import { Toolbar, formatDateTime } from "../_components/ui";
import { InlineField } from "@/components/Fields";

const API = "/api/managements/sanctions/import";

const STATUSES = {
  RUNNING: { label: "Явагдаж байна", tone: "blue" },
  SUCCESS: { label: "Шинэчлэгдсэн", tone: "green" },
  NO_CHANGE: { label: "Өөрчлөлтгүй", tone: "gray" },
  FAILED: { label: "Алдаа", tone: "red" },
};

const RESULT_STYLES = {
  SUCCESS: "text-green-700",
  NO_CHANGE: "text-gray-500",
  FAILED: "text-red-600",
};

const duration = (item) => {
  if (!item.finishedAt) return "—";
  const seconds = Math.round((new Date(item.finishedAt) - new Date(item.startedAt)) / 1000);
  return seconds < 60 ? `${seconds}с` : `${Math.floor(seconds / 60)}м ${seconds % 60}с`;
};

// Эх сурвалжийн карт: тоо, огноо, импорт товч ба үр дүн
const SourceCard = ({ source, pending, result, onImport, disabled }) => (
  <Card className="flex flex-col">
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">{source.name}</h2>
        <a
          href={source.infoUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs text-blue-600 hover:underline"
        >
          Эх сурвалж ↗
        </a>
      </div>
      <p className="text-sm text-gray-500">{source.description}</p>
    </div>
    <dl className="flex-1 space-y-1 text-sm">
      <InlineField label="Бичлэг" value={source.count.toLocaleString("en-US")} />
      <InlineField label="Сүүлд импортолсон" value={formatDateTime(source.importedAt)} />
      <InlineField label="Сүүлд шалгасан" value={formatDateTime(source.checkedAt)} />
      {source.publishedAt && (
        <InlineField label="Жагсаалтын огноо" value={formatDateTime(source.publishedAt)} />
      )}
    </dl>
    <div className="space-y-2">
      <Button variant="primary" className="w-full" onClick={onImport} disabled={disabled}>
        {pending ? "Импортолж байна..." : "Импорт"}
      </Button>
      {result && (
        <p className={`text-center text-sm ${RESULT_STYLES[result.status]}`}>{result.message}</p>
      )}
    </div>
  </Card>
);

const SanctionsManager = ({ sources, history }) => {
  const router = useRouter();
  // Одоо импортолж буй эх сурвалжууд, эх сурвалж бүрийн сүүлийн хариу
  const [pending, setPending] = useState([]);
  const [results, setResults] = useState({});

  const runImport = async (key) => {
    setPending((keys) => [...keys, key]);
    setResults((current) => ({ ...current, [key]: null }));
    const result = await sendJson(API, "POST", { source: key });
    setResults((current) => ({
      ...current,
      [key]: result.ok
        ? { status: result.status, message: result.message }
        : { status: "FAILED", message: result.errors.form },
    }));
    setPending((keys) => keys.filter((k) => k !== key));
    router.refresh();
  };

  // Нэг хүсэлт function-ий хугацаанд багтахаар эх сурвалжуудыг ээлжлэн импортлоно
  const importAll = async () => {
    for (const source of sources) await runImport(source.key);
  };

  const busy = pending.length > 0;

  return (
    <div className="space-y-6">
      <Toolbar>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={importAll} disabled={busy}>
            {busy ? "Импортолж байна..." : "Бүгдийг импортлох"}
          </Button>
        </div>
      </Toolbar>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <SourceCard
            key={source.key}
            source={source}
            pending={pending.includes(source.key)}
            result={results[source.key]}
            onImport={() => runImport(source.key)}
            disabled={busy}
          />
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Импортын түүх</h2>
        {history.length === 0 ? (
          <EmptyState>Импорт хийгдээгүй байна</EmptyState>
        ) : (
          <Table
            headers={["Огноо", "Эх сурвалж", "Төлөв", "Нийт", "Нэмэгдсэн", "Өөрчлөгдсөн", "Хасагдсан", "Хугацаа", "Хэн"]}
          >
            {history.map((item) => (
              <tr key={item.id}>
                <Cell className="whitespace-nowrap text-gray-600">{formatDateTime(item.startedAt)}</Cell>
                <Cell className="whitespace-nowrap font-medium text-gray-900">
                  {sources.find((source) => source.key === item.source)?.name ?? item.source}
                </Cell>
                <Cell>
                  <span title={item.error ?? undefined}>
                    <StatusBadge status={item.status} statuses={STATUSES} />
                  </span>
                  {item.error && (
                    <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={item.error}>
                      {item.error}
                    </p>
                  )}
                </Cell>
                <Cell>{item.total ? item.total.toLocaleString("en-US") : "—"}</Cell>
                <Cell className="text-green-700">{item.added ? `+${item.added}` : "—"}</Cell>
                <Cell className="text-amber-700">{item.updated || "—"}</Cell>
                <Cell className="text-red-600">{item.removed ? `−${item.removed}` : "—"}</Cell>
                <Cell className="text-gray-500">{duration(item)}</Cell>
                <Cell className="whitespace-nowrap text-gray-600">
                  {personName(item.user, "Автомат")}
                </Cell>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
};

export default SanctionsManager;
