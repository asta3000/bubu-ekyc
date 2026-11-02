import { Badge } from "@/components/Badges";
import { Card } from "@/components/Cards";
import { NameList, ReportTabs, StatTiles } from "@/components/Reports";
import { Cell, Table } from "@/components/Tables";
import { PageTitle } from "@/components/Titles";
import { formatDate, formatMoney } from "@/lib/format";
import { organizationUsersReport, packageOrganizationsReport, promoUsageReport } from "@/lib/reports/admin";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Тайлан" };

const TABS = [
  { key: "packages", label: "Багц ба байгууллага" },
  { key: "users", label: "Байгууллагын хэрэглэгч" },
  { key: "promo", label: "Промо кодын ашиглалт" },
];

const PACKAGE_STATUS = {
  ACTIVE: null,
  INACTIVE: <Badge>Идэвхгүй</Badge>,
  DELETED: <Badge tone="red">Устгагдсан</Badge>,
};

// 1. Багц тус бүр дээр одоо хэдэн байгууллага байгаа
const PackagesReport = async () => {
  const { rows, withoutPackage, total } = await packageOrganizationsReport();
  const subscribed = total - withoutPackage.length;
  return (
    <div className="space-y-4">
      <StatTiles
        stats={[
          { label: "Нийт байгууллага", value: total },
          { label: "Идэвхтэй багцтай", value: subscribed },
          { label: "Идэвхтэй багцгүй", value: withoutPackage.length },
        ]}
      />
      <Card title="Багц тус бүр дээрх байгууллага" description="Одоо хүчинтэй (идэвхтэй, хугацаа дуусаагүй) захиалгаар тоолсон.">
        <Table headers={["Багц", "Үнэ", "Байгууллагын тоо", "Байгууллагууд"]}>
          {rows.map((row) => (
            <tr key={row.key} className="align-top">
              <Cell className="font-medium text-gray-900">
                {row.name} {PACKAGE_STATUS[row.status]}
              </Cell>
              <Cell className="whitespace-nowrap text-gray-600">
                {row.basePrice != null ? formatMoney(row.basePrice) : "—"}
                {row.durationDays ? ` / ${row.durationDays} хоног` : ""}
              </Cell>
              <Cell className="text-lg font-semibold tabular-nums">{row.organizations.length}</Cell>
              <Cell>
                <NameList names={row.organizations} />
              </Cell>
            </tr>
          ))}
          <tr className="align-top bg-gray-50">
            <Cell className="font-medium text-gray-700">Идэвхтэй багцгүй</Cell>
            <Cell />
            <Cell className="text-lg font-semibold tabular-nums">{withoutPackage.length}</Cell>
            <Cell>
              <NameList names={withoutPackage} />
            </Cell>
          </tr>
        </Table>
      </Card>
    </div>
  );
};

// 2. Байгууллага бүрийн хэрэглэгчийн тоо
const UsersReport = async () => {
  const { rows, totals, since } = await organizationUsersReport();
  return (
    <div className="space-y-4">
      <StatTiles
        stats={[
          { label: "Нийт хэрэглэгч", value: totals.total },
          { label: "Идэвхтэй", value: totals.active },
          { label: "Идэвхгүй", value: totals.inactive },
          { label: "Сүүлийн 1 сард бүртгүүлсэн", value: totals.recent, hint: `${formatDate(since)}-с хойш` },
        ]}
      />
      <Card
        title="Байгууллага бүрийн хэрэглэгч"
        description="Устгагдсан болон системийн админ хэрэглэгчийг тооцоогүй. Сүүлийн 1 сар = сүүлийн 30 хоног."
      >
        <Table headers={["Байгууллага", "Гэрээ", "Нийт", "Идэвхтэй", "Идэвхгүй", "Сүүлийн 1 сард"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Cell>
                <p className="font-medium text-gray-900">
                  {row.name} {row.status === "INACTIVE" && <Badge>Идэвхгүй</Badge>}
                </p>
                {row.customerNumber && <p className="font-mono text-xs text-gray-500">{row.customerNumber}</p>}
              </Cell>
              <Cell>
                <Badge tone={row.contractSigned ? "green" : "gray"}>{row.contractSigned ? "Тийм" : "Үгүй"}</Badge>
              </Cell>
              <Cell className="font-semibold tabular-nums">{row.total}</Cell>
              <Cell className="tabular-nums text-green-700">{row.active}</Cell>
              <Cell className="tabular-nums text-gray-500">{row.inactive}</Cell>
              <Cell className="tabular-nums">{row.recent}</Cell>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
};

// 3. Промо кодын ашиглалт
const PromoReport = async () => {
  const { rows, usedPromo, withoutPromo, total } = await promoUsageReport();
  return (
    <div className="space-y-4">
      <StatTiles
        stats={[
          { label: "Нийт байгууллага", value: total },
          { label: "Промо код ашиглаж бүртгүүлсэн", value: usedPromo },
          { label: "Промо код ашиглаагүй", value: withoutPromo },
        ]}
      />
      <Card
        title="Байгууллага бүрийн промо кодыг ашигласан байгууллага"
        description="Тухайн байгууллагын промо кодыг ашиглаж бүртгүүлсэн (устгагдаагүй) байгууллагын тоо ба тэдний төлбөрөөс авсан урамшуулал."
      >
        <Table headers={["Байгууллага", "Промо код", "Хувь", "Ашигласан байгууллага", "Авсан урамшуулал"]}>
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <Cell className="font-medium text-gray-900">{row.name}</Cell>
              <Cell className="font-mono text-sm tracking-wider">{row.codes.join(", ") || "—"}</Cell>
              <Cell className="tabular-nums">{row.rate != null ? `${row.rate}%` : "—"}</Cell>
              <Cell>
                <p className="text-lg font-semibold tabular-nums">{row.referred.length}</p>
                {row.referred.length > 0 && <NameList names={row.referred} />}
              </Cell>
              <Cell className="whitespace-nowrap tabular-nums">{row.earned ? formatMoney(row.earned) : "—"}</Cell>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
};

const REPORTS = { packages: PackagesReport, users: UsersReport, promo: PromoReport };

const ReportsPage = async ({ searchParams }) => {
  await requireAdminPage();
  const { report } = await searchParams;
  const active = REPORTS[report] ? report : TABS[0].key;
  const Report = REPORTS[active];

  return (
    <div className="space-y-4">
      <PageTitle title="Тайлан" description="Багц, байгууллагын хэрэглэгч, промо кодын ашиглалтын тайлан" />
      <ReportTabs tabs={TABS} active={active} />
      <Report />
    </div>
  );
};

export default ReportsPage;
