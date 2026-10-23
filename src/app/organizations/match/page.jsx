import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { countryOptions } from "@/lib/screening/countries";
import { getMatchingConfig } from "@/lib/screening/matching-settings";
import { organizationScope, requireOrganizationPage } from "@/lib/organization-access";
import { SANCTION_SOURCES } from "@/lib/sanctions/sources";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import MatchForm from "../_components/match-form";
import MatchHistory from "../_components/match-history";
import ServiceAllowance from "../_components/service-allowance";

export const metadata = { title: "Хориг тулгах" };

const PAGE = {
  title: "Хоригийн жагсаалттай тулгах",
  description: "Харилцагч НҮБ, ЕХ, АНУ, Их Британийн хоригийн жагсаалтад орсон эсэхийг шалгана.",
};

const HISTORY_LIMIT = 30;

// Жагсаалт бүрийн бичлэгийн тоо, сүүлд шинэчлэгдсэн (амжилттай импортолсон) огноо
async function sourceStats() {
  const [counts, imports] = await Promise.all([
    prisma.sanctionEntry.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.sanctionImport.findMany({
      where: { status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      distinct: ["source"],
      select: { source: true, startedAt: true },
    }),
  ]);
  return SANCTION_SOURCES.map(({ key, name }) => {
    const updatedAt = imports.find((row) => row.source === key)?.startedAt;
    return {
      key,
      name,
      count: counts.find((row) => row.source === key)?._count._all ?? 0,
      updatedAt: updatedAt ? formatDate(updatedAt) : null,
    };
  });
}

// searchParams: баталгаажуулалтаас ирэхэд name, birthDate, subjectType-ээр form-ыг бөглөнө
const MatchPage = async ({ searchParams }) => {
  const { session, organization, accessError } = await requireOrganizationPage();
  if (accessError) return <AccessDenied {...PAGE} error={accessError} />;

  const isAdmin = session.user.role === "ADMIN";
  const [sources, screenings, matching] = await Promise.all([
    sourceStats(),
    prisma.screening.findMany({
      where: organizationScope(session, organization),
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        name: true,
        subjectType: true,
        matchCount: true,
        topScore: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
        organization: { select: { name: true } },
      },
    }),
    getMatchingConfig(),
  ]);

  return (
    <>
      <PageTitle {...PAGE} />
      <ServiceAllowance organization={organization} service="SANCTION_SCREENING" />
      <MatchForm
        countries={countryOptions()}
        sources={sources}
        defaults={await searchParams}
        defaultThreshold={matching.defaultThreshold}
      />
      <div className="space-y-3">
        <h2 className="text-base font-semibold">
          {isAdmin ? "Тулгалтын түүх" : `${organization.name} — тулгалтын түүх`}
        </h2>
        <MatchHistory screenings={screenings} showOrganization={isAdmin} />
      </div>
    </>
  );
};

export default MatchPage;
