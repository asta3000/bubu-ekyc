import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { SANCTION_SOURCES } from "@/lib/sanctions/sources";
import { PageTitle } from "@/components/Titles";
import SanctionsManager from "./sanctions-manager";

export const metadata = { title: "Хоригийн жагсаалт" };

const HISTORY_LIMIT = 50;

// Эх сурвалж бүрийн сүүлийн импорт (status-аар шүүсэн)
const latestBySource = (statuses) =>
  prisma.sanctionImport.findMany({
    where: { status: { in: statuses } },
    orderBy: { startedAt: "desc" },
    distinct: ["source"],
    select: { source: true, startedAt: true, publishedAt: true },
  });

const SanctionsPage = async () => {
  await requireAdminPage();
  const [counts, imported, checked, history] = await Promise.all([
    prisma.sanctionEntry.groupBy({ by: ["source"], _count: { _all: true } }),
    latestBySource(["SUCCESS"]),
    latestBySource(["SUCCESS", "NO_CHANGE"]),
    prisma.sanctionImport.findMany({
      orderBy: { startedAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        source: true,
        status: true,
        total: true,
        added: true,
        updated: true,
        removed: true,
        error: true,
        startedAt: true,
        finishedAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const find = (rows, key) => rows.find((row) => row.source === key);
  const sources = SANCTION_SOURCES.map((source) => ({
    ...source,
    count: find(counts, source.key)?._count._all ?? 0,
    importedAt: find(imported, source.key)?.startedAt ?? null,
    checkedAt: find(checked, source.key)?.startedAt ?? null,
    publishedAt: find(checked, source.key)?.publishedAt ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Хоригийн жагсаалт"
        description="НҮБ, ЕХ, АНУ, Их Британийн хоригийн жагсаалтыг эх сурвалжаас нь татаж шинэчилнэ (ЕХ 833/2014 XLV хавсралтыг кодонд хөтөлдөг). Өдөр бүр автоматаар шалгана."
      />
      <SanctionsManager sources={sources} history={history} />
    </div>
  );
};

export default SanctionsPage;
