import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime, personName } from "@/lib/format";
import { countryLabel } from "@/lib/screening/countries";
import { organizationScope, requireOrganizationPage } from "@/lib/organization-access";
import { sanctionSource } from "@/lib/sanctions/sources";
import { Card } from "@/components/Cards";
import { TextLink } from "@/components/Links";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import { SUBJECT_LABELS } from "../../_components/labels";
import MatchResults from "../../_components/match-results";
import { Field } from "@/components/Fields";

export const metadata = { title: "Тулгалтын үр дүн" };

// Хадгалагдсан тулгалт: тухайн үед хайсан утга, олдсон тохирлын хуулбар
const MatchDetailPage = async ({ params }) => {
  const { session, organization, accessError } = await requireOrganizationPage();
  if (accessError) return <AccessDenied error={accessError} />;

  const { id } = await params;
  const screening = await prisma.screening.findFirst({
    where: { id, ...organizationScope(session, organization) },
    include: {
      user: { select: { firstName: true, lastName: true } },
      organization: { select: { name: true } },
    },
  });
  if (!screening) notFound();

  // Тохирол бүрийн хэвлэлтийн түүх
  const printRows = await prisma.screeningPrint.findMany({
    where: { screeningId: screening.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentNumber: true,
      matchIndex: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  const prints = {};
  for (const row of printRows) {
    (prints[row.matchIndex] ??= []).push({
      id: row.id,
      number: row.documentNumber,
      by: personName(row.user),
      at: formatDateTime(row.createdAt),
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title={screening.name} description={`Тулгасан: ${formatDateTime(screening.createdAt)}`} />
        <TextLink href="/organizations/match">← Шинэ тулгалт</TextLink>
      </div>
      <Card title="Хайсан мэдээлэл">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Төрөл" value={SUBJECT_LABELS[screening.subjectType] ?? "Бүгд"} />
          <Field label="Төрсөн он / огноо" value={screening.birthDate} />
          <Field label="Улс" value={countryLabel(screening.country)} />
          <Field label="Бичиг баримтын дугаар" value={screening.identifier} />
          <Field label="Тохирлын босго" value={`${screening.threshold}%`} />
          <Field
            label="Шалгасан"
            value={personName(screening.user, null)}
          />
          <Field label="Байгууллага" value={screening.organization?.name} />
          <Field
            label="Жагсаалтууд"
            value={screening.sources.map((key) => sanctionSource(key)?.name ?? key).join(", ")}
          />
        </dl>
      </Card>
      <MatchResults results={screening.results} screeningId={screening.id} prints={prints} />
    </>
  );
};

export default MatchDetailPage;
