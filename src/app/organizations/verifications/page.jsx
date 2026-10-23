import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime, personName } from "@/lib/format";
import { organizationScope, requireOrganizationPage } from "@/lib/organization-access";
import { StatusBadge } from "@/components/Badges";
import { AccessDenied, EmptyState } from "@/components/Messages";
import { Cell, Table } from "@/components/Tables";
import { PageTitle } from "@/components/Titles";
import ServiceAllowance from "../_components/service-allowance";
import VerificationForm from "../_components/verification-form";
import { VERIFICATION_STATUSES } from "../_components/verification-labels";

export const metadata = { title: "Иргэний баталгаажуулалт" };

const PAGE = {
  title: "Иргэний баталгаажуулалт",
  description: "Гадаад паспорт эсвэл Монгол Улсын иргэний үнэмлэхээс мэдээлэл уншиж, сельфи зурагтай тулгана.",
};

const HISTORY_LIMIT = 30;

const VerificationsPage = async () => {
  const { session, organization, accessError } = await requireOrganizationPage();
  if (accessError) return <AccessDenied {...PAGE} error={accessError} />;

  const isAdmin = session.user.role === "ADMIN";
  const verifications = await prisma.identityVerification.findMany({
    where: organizationScope(session, organization),
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      id: true,
      status: true,
      fullName: true,
      documentType: true,
      documentNumber: true,
      faceMatchScore: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
      organization: { select: { name: true } },
    },
  });

  const headers = ["Огноо", "Нэр", "Баримт", "Нүүр тулгалт", "Төлөв", "Шалгасан", ...(isAdmin ? ["Байгууллага"] : [])];
  return (
    <>
      <PageTitle {...PAGE} />
      <ServiceAllowance organization={organization} service="DOCUMENT_VERIFICATION" />
      <VerificationForm />
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Түүх</h2>
        {verifications.length === 0 ? (
          <EmptyState>Баталгаажуулалт хийгдээгүй байна</EmptyState>
        ) : (
          <Table headers={headers}>
            {verifications.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <Cell className="whitespace-nowrap text-gray-600">{formatDateTime(item.createdAt)}</Cell>
                <Cell>
                  <Link
                    href={`/organizations/verifications/${item.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {item.fullName ?? "Нэр уншигдаагүй"}
                  </Link>
                </Cell>
                <Cell className="text-gray-600">
                  {[item.documentType, item.documentNumber].filter(Boolean).join(" · ") || "—"}
                </Cell>
                <Cell>{item.faceMatchScore != null ? `${Math.round(item.faceMatchScore)}%` : "—"}</Cell>
                <Cell>
                  <StatusBadge status={item.status} statuses={VERIFICATION_STATUSES} />
                </Cell>
                <Cell className="whitespace-nowrap text-gray-600">
                  {personName(item.user)}
                </Cell>
                {isAdmin && <Cell className="text-gray-600">{item.organization?.name ?? "—"}</Cell>}
              </tr>
            ))}
          </Table>
        )}
      </div>
    </>
  );
};

export default VerificationsPage;
