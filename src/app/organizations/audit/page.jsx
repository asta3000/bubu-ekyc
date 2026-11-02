import { auditFilters, auditOptions, queryAuditLogs } from "@/lib/audit/query";
import { requireOrgAdminPage } from "@/lib/organization-access";
import { AuditFilters, AuditPagination, AuditTable } from "@/components/AuditLog";
import { AccessDenied } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";

export const metadata = { title: "Үйлдлийн түүх" };

const PAGE = {
  title: "Үйлдлийн түүх",
  description: "Байгууллагын хэрэглэгчдийн хийсэн үйлдлүүд: хэн, хэзээ, юу хийсэн",
};

// Байгууллагын админд: зөвхөн өөрийн байгууллагын, ерөнхий мэдээлэл
const OrganizationAuditPage = async ({ searchParams }) => {
  const { organization, accessError } = await requireOrgAdminPage();
  if (accessError) return <AccessDenied {...PAGE} error={accessError} />;

  const filters = auditFilters(await searchParams);
  const result = await queryAuditLogs(filters, { organizationId: organization.id });

  return (
    <div className="space-y-4">
      <PageTitle {...PAGE} />
      <AuditFilters filters={filters} options={auditOptions(true)} />
      <AuditTable logs={result.logs} />
      <AuditPagination filters={filters} {...result} />
    </div>
  );
};

export default OrganizationAuditPage;
