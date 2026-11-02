import { prisma } from "@/lib/prisma";
import { auditFilters, auditOptions, queryAuditLogs } from "@/lib/audit/query";
import { requireAdminPage } from "@/lib/session";
import { AuditFilters, AuditPagination, AuditTable } from "@/components/AuditLog";
import { PageTitle } from "@/components/Titles";

export const metadata = { title: "Аудит лог" };

// Системийн бүх үйлдлийн лог: IP, browser, өөрчлөлт, нэмэлт мэдээлэлтэй
const AuditPage = async ({ searchParams }) => {
  await requireAdminPage();
  const filters = auditFilters(await searchParams);
  const [result, organizations] = await Promise.all([
    queryAuditLogs(filters),
    prisma.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-4">
      <PageTitle title="Аудит лог" description="Хэн, хэзээ, хаанаас, юуг юу болгосон тухай бүх үйлдлийн түүх" />
      <AuditFilters
        filters={filters}
        options={auditOptions(false)}
        organizations={organizations.map(({ id, name }) => ({ value: id, label: name }))}
      />
      <AuditTable
        logs={result.logs}
        admin
        organizations={Object.fromEntries(organizations.map(({ id, name }) => [id, name]))}
      />
      <AuditPagination filters={filters} {...result} />
    </div>
  );
};

export default AuditPage;
