import Link from "next/link";

// Тайлангийн хуудасны нийтлэг хэсгүүд: тайлан сонгох таб, товч үзүүлэлтүүд.

// tabs: [{ key, label }]. Тайлан бүр ?report=<key> хаягтай тул холбоосоор хуваалцаж болно.
export const ReportTabs = ({ tabs, active }) => (
  <nav className="flex flex-wrap gap-2">
    {tabs.map((tab, index) => (
      <Link
        key={tab.key}
        href={`?report=${tab.key}`}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
          tab.key === active
            ? "border-blue-600 bg-blue-50 text-blue-700"
            : "border-gray-200 bg-white text-gray-600 hover:text-gray-900"
        }`}
      >
        {index + 1}. {tab.label}
      </Link>
    ))}
  </nav>
);

// stats: [{ label, value, hint }]
export const StatTiles = ({ stats }) => (
  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {stats.map((stat) => (
      <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4">
        <dt className="text-sm text-gray-500">{stat.label}</dt>
        <dd className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{stat.value}</dd>
        {stat.hint && <dd className="mt-0.5 text-xs text-gray-500">{stat.hint}</dd>}
      </div>
    ))}
  </dl>
);

// Нэрсийн жагсаалтыг тоогоор, дарахад дэлгэх
export const NameList = ({ names, empty = "—" }) =>
  names.length ? (
    <details>
      <summary className="cursor-pointer text-blue-600 hover:underline">{names.length} байгууллага</summary>
      <ul className="mt-1 space-y-0.5 text-gray-600">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </details>
  ) : (
    <span className="text-gray-400">{empty}</span>
  );
