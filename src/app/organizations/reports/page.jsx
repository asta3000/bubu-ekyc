import Link from "next/link";
import { Badge } from "@/components/Badges";
import { Button } from "@/components/Buttons";
import { Card } from "@/components/Cards";
import { Input } from "@/components/Inputs";
import { AccessDenied, EmptyState } from "@/components/Messages";
import { ReportTabs, StatTiles } from "@/components/Reports";
import { Cell, Table } from "@/components/Tables";
import { PageTitle } from "@/components/Titles";
import { PAYMENT_METHODS, SUBSCRIPTION_STATUSES } from "@/lib/billing/labels";
import { BILLABLE_SERVICES } from "@/lib/billing/services";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { requireOrgAdminPage } from "@/lib/organization-access";
import { PURCHASE_KINDS, periodFilter, serviceUsageReport, subscriptionHistoryReport } from "@/lib/reports/organization";

export const metadata = { title: "Тайлан" };

const PAGE = { title: "Тайлан", description: "Байгууллагын багцын түүх, хэрэглэгчдийн үйлчилгээний ашиглалт" };

const TABS = [
  { key: "packages", label: "Багцын түүх" },
  { key: "usage", label: "Хэрэглэгчийн ашиглалт" },
];

// 1. Ямар багц худалдаж авсан, сунгасан
const PackagesReport = async ({ organization }) => {
  const { rows, totals } = await subscriptionHistoryReport(organization.id);
  return (
    <div className="space-y-4">
      <StatTiles
        stats={[
          { label: "Идэвхжсэн багц", value: totals.count },
          { label: "Үүнээс сунгалт", value: totals.renewals },
          { label: "Нийт төлсөн", value: formatMoney(totals.paid), hint: "Багцын суурь үнэ (задгай ашиглалтгүй)" },
        ]}
      />
      <Card title="Багц худалдан авалт, сунгалтын түүх" description="Шинэ нь эхэндээ. Сунгалт = ижил багцыг дахин авсан.">
        {rows.length === 0 ? (
          <EmptyState>Багц худалдаж аваагүй байна</EmptyState>
        ) : (
          <Table headers={["Огноо", "Багц", "Төрөл", "Хүчинтэй хугацаа", "Төлсөн", "Төлбөрийн арга", "Хэн", "Төлөв"]}>
            {rows.map((row) => {
              const kind = PURCHASE_KINDS[row.kind];
              const status = SUBSCRIPTION_STATUSES[row.status];
              return (
                <tr key={row.id} className="align-top">
                  <Cell className="whitespace-nowrap text-gray-600">{formatDateTime(row.createdAt)}</Cell>
                  <Cell className="font-medium text-gray-900">{row.packageName}</Cell>
                  <Cell>
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                  </Cell>
                  <Cell className="whitespace-nowrap text-gray-600">
                    {row.startsAt ? `${formatDate(row.startsAt)} — ${row.expiresAt ? formatDate(row.expiresAt) : "хугацаагүй"}` : "—"}
                  </Cell>
                  <Cell className="whitespace-nowrap tabular-nums">
                    {row.paid ? formatMoney(row.paid) : row.basePrice === 0 ? "Үнэгүй" : "—"}
                    {row.coupon && <p className="text-xs text-gray-500">Купон {row.coupon}</p>}
                  </Cell>
                  <Cell className="text-gray-600">{row.method ? PAYMENT_METHODS[row.method] : "—"}</Cell>
                  <Cell className="text-gray-600">{row.kind === "AUTO_RENEW" ? "Систем" : personName(row.by)}</Cell>
                  <Cell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Cell>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
};

const ServiceCount = ({ value }) => {
  const total = value.quota + value.overage;
  if (!total) return <span className="text-gray-300">0</span>;
  return (
    <>
      <span className="font-semibold tabular-nums">{total}</span>
      {value.overage > 0 && <p className="text-xs text-amber-700">үүнээс {value.overage} задгай үнээр</p>}
    </>
  );
};

// 2. Хэрэглэгч бүр аль үйлчилгээг хэдэн удаа ашигласан
const UsageReport = async ({ organization, params }) => {
  const period = periodFilter(params);
  const { rows, totals } = await serviceUsageReport(organization.id, period);
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <input type="hidden" name="report" value="usage" />
        <Input label="Эхлэх огноо" name="from" type="date" defaultValue={period.from} />
        <Input label="Дуусах огноо" name="to" type="date" defaultValue={period.to} />
        <Button variant="primary" type="submit">
          Шүүх
        </Button>
        <Link href="?report=usage" className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900">
          Бүх хугацаа
        </Link>
      </form>
      <StatTiles
        stats={[
          ...BILLABLE_SERVICES.map((service) => ({ label: service.name, value: totals.services[service.key] })),
          { label: "Задгай үнээр төлсөн", value: formatMoney(totals.amount), hint: "Багцын тоо дууссаны дараах ашиглалт" },
        ]}
      />
      <Card
        title="Хэрэглэгч бүрийн үйлчилгээний ашиглалт"
        description="Амжилтгүй болж буцаагдсан ашиглалтыг тооцоогүй. Хугацаа сонгоогүй бол бүх хугацааны."
      >
        {rows.length === 0 ? (
          <EmptyState>Энэ хугацаанд ашиглалт байхгүй</EmptyState>
        ) : (
          <Table headers={["Хэрэглэгч", ...BILLABLE_SERVICES.map((service) => service.name), "Нийт", "Задгай үнээр төлсөн"]}>
            {rows.map((row) => (
              <tr key={row.key} className="align-top">
                <Cell>
                  <p className="font-medium text-gray-900">
                    {row.user ? personName(row.user) : "Устгагдсан хэрэглэгч"}{" "}
                    {row.user?.status === "INACTIVE" && <Badge>Идэвхгүй</Badge>}
                  </p>
                  {row.user && <p className="text-xs text-gray-500">{row.user.email}</p>}
                </Cell>
                {BILLABLE_SERVICES.map((service) => (
                  <Cell key={service.key}>
                    <ServiceCount value={row.services[service.key]} />
                  </Cell>
                ))}
                <Cell className="text-lg font-semibold tabular-nums">{row.total}</Cell>
                <Cell className="whitespace-nowrap tabular-nums">{row.amount ? formatMoney(row.amount) : "—"}</Cell>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
};

const REPORTS = { packages: PackagesReport, usage: UsageReport };

// Байгууллагын админд: зөвхөн өөрийн байгууллагын тайлан
const OrganizationReportsPage = async ({ searchParams }) => {
  const { organization, accessError } = await requireOrgAdminPage();
  if (accessError) return <AccessDenied {...PAGE} error={accessError} />;

  const params = await searchParams;
  const active = REPORTS[params.report] ? params.report : TABS[0].key;
  const Report = REPORTS[active];

  return (
    <div className="space-y-4">
      <PageTitle {...PAGE} />
      <ReportTabs tabs={TABS} active={active} />
      <Report organization={organization} params={params} />
    </div>
  );
};

export default OrganizationReportsPage;
