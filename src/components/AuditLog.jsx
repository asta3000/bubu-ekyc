import Link from "next/link";
import { Badge } from "@/components/Badges";
import { Button } from "@/components/Buttons";
import { Input, Select } from "@/components/Inputs";
import { EmptyState } from "@/components/Messages";
import { Cell, Table } from "@/components/Tables";
import { auditActionLabel, auditCategory, auditCategoryLabel } from "@/lib/audit/actions";
import { describeUserAgent } from "@/lib/audit/user-agent";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";

// Аудит логийн шүүлтүүр, хүснэгт, хуудаслалт. admin бол IP, browser, өөрчлөлт, нэмэлт
// мэдээллийг харуулна; байгууллагын админд ерөнхий мэдээлэл (хэн, хэзээ, юу) л.

// Шүүлтүүр (GET form тул URL-д хадгалагдаж, холбоосоор хуваалцаж болно)
export const AuditFilters = ({ filters, options, organizations }) => (
  <form method="get" className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
    <div className="md:col-span-3 xl:col-span-2">
      <Input label="Хайх" name="q" type="search" defaultValue={filters.q} placeholder="Хэрэглэгч, и-мэйл, тайлбар" />
    </div>
    <Select label="Ангилал" name="category" defaultValue={filters.category} placeholder="Бүгд" options={options.categories} />
    <Select label="Үйлдэл" name="action" defaultValue={filters.action} placeholder="Бүгд" options={options.actions} />
    {organizations && (
      <Select
        label="Байгууллага"
        name="organizationId"
        defaultValue={filters.organizationId}
        placeholder="Бүгд"
        options={organizations}
      />
    )}
    <Select
      label="Төлөв"
      name="status"
      defaultValue={filters.status}
      placeholder="Бүгд"
      options={[
        { value: "SUCCESS", label: "Амжилттай" },
        { value: "FAILURE", label: "Амжилтгүй" },
      ]}
    />
    <Input label="Эхлэх огноо" name="from" type="date" defaultValue={filters.from} />
    <Input label="Дуусах огноо" name="to" type="date" defaultValue={filters.to} />
    <div className="flex items-end gap-2">
      <Button variant="primary" type="submit">
        Шүүх
      </Button>
      <Link href="?" className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900">
        Цэвэрлэх
      </Link>
    </div>
  </form>
);

// Хийсэн хүн. Байгууллагын админд системийн админы нэрийг ил гаргахгүй.
const actorText = (log, admin) => {
  if (!log.actorId && !log.actorEmail) return { name: "Систем" };
  if (!admin && log.actorRole === "ADMIN") return { name: "Системийн админ" };
  return {
    name: log.actorName || log.actorEmail,
    detail: admin ? [log.actorName && log.actorEmail, ROLE_LABELS[log.actorRole]].filter(Boolean).join(" · ") : null,
  };
};

const formatValue = (value) =>
  value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);

// Админд: өөрчлөлт, бичлэг, нэмэлт мэдээлэл, бүтэн user agent
const AuditDetails = ({ log }) => {
  const changes = log.changes && Object.entries(log.changes);
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-blue-600 hover:underline">Дэлгэрэнгүй</summary>
      <div className="mt-2 max-w-xl space-y-2 rounded-md bg-gray-50 p-3 text-gray-700">
        {changes?.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pr-2 font-medium">Талбар</th>
                <th className="pr-2 font-medium">Өмнө</th>
                <th className="font-medium">Дараа</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(([field, { from, to }]) => (
                <tr key={field} className="align-top">
                  <td className="pr-2 font-mono">{field}</td>
                  <td className="pr-2 break-all text-red-700">{formatValue(from)}</td>
                  <td className="break-all text-green-700">{formatValue(to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {log.entityType && (
          <p>
            <span className="text-gray-500">Бичлэг: </span>
            <span className="font-mono">
              {log.entityType} {log.entityId}
            </span>
          </p>
        )}
        {log.metadata && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono">{JSON.stringify(log.metadata, null, 2)}</pre>
        )}
        {log.userAgent && <p className="break-all text-gray-500">{log.userAgent}</p>}
        <p className="font-mono text-gray-400">{log.action}</p>
      </div>
    </details>
  );
};

// organizations: { [id]: name } (админд байгууллагын нэр харуулахад)
export const AuditTable = ({ logs, admin = false, organizations = {} }) => {
  if (!logs.length) return <EmptyState>Лог олдсонгүй</EmptyState>;
  const headers = admin
    ? ["Огноо", "Хэрэглэгч", "Байгууллага", "Үйлдэл", "Тайлбар", "IP / Browser"]
    : ["Огноо", "Хэрэглэгч", "Үйлдэл", "Тайлбар"];

  return (
    <Table headers={headers}>
      {logs.map((log) => {
        const actor = actorText(log, admin);
        return (
          <tr key={log.id} className="align-top">
            <Cell className="whitespace-nowrap text-gray-600 tabular-nums">{formatDateTime(log.createdAt)}</Cell>
            <Cell>
              <p className="font-medium text-gray-900">{actor.name}</p>
              {actor.detail && <p className="text-xs text-gray-500">{actor.detail}</p>}
            </Cell>
            {admin && <Cell className="text-gray-600">{organizations[log.organizationId] ?? "—"}</Cell>}
            <Cell>
              <p className="text-gray-900">{auditActionLabel(log.action)}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge>{auditCategoryLabel(auditCategory(log.action))}</Badge>
                {log.status === "FAILURE" && <Badge tone="red">Амжилтгүй</Badge>}
              </div>
            </Cell>
            <Cell className="max-w-md text-gray-600">
              <p className="break-words">{log.summary ?? "—"}</p>
              {admin && <AuditDetails log={log} />}
            </Cell>
            {admin && (
              <Cell className="whitespace-nowrap text-xs text-gray-600">
                <p className="font-mono">{log.ip ?? "—"}</p>
                <p>{describeUserAgent(log.userAgent) ?? "—"}</p>
              </Cell>
            )}
          </tr>
        );
      })}
    </Table>
  );
};

// Хуудаслалт. Шүүлтүүрийг хадгалж page-ийг л солино.
export const AuditPagination = ({ filters, page, pages, total }) => {
  const href = (target) => {
    const params = new URLSearchParams(
      Object.entries({ ...filters, page: target }).filter(([key, value]) => value && !(key === "page" && value === 1)),
    );
    return `?${params}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>
        Нийт {total.toLocaleString("en-US")} бичлэг · {page}/{pages} хуудас
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50">
            Өмнөх
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50">
            Дараах
          </Link>
        )}
      </div>
    </div>
  );
};
