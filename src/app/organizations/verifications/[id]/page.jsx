import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime, personName } from "@/lib/format";
import { getDecision } from "@/lib/didit";
import { isXypConfigured } from "@/lib/xyp";
import { organizationScope, requireOrganizationPage } from "@/lib/organization-access";
import { StatusBadge } from "@/components/Badges";
import { Card } from "@/components/Cards";
import { ButtonLink, TextLink } from "@/components/Links";
import { AccessDenied, Message } from "@/components/Messages";
import { PageTitle } from "@/components/Titles";
import RegistryPanel from "../../_components/registry-panel";
import { CHECK_STATUSES, GENDERS, VERIFICATION_STATUSES } from "../../_components/verification-labels";
import { Field } from "@/components/Fields";

export const metadata = { title: "Баталгаажуулалтын үр дүн" };

// Didit-ийн media URL богино хугацаанд хүчинтэй тул хуудас нээх бүрт шинээр авна
const DiditImage = ({ src, label }) => (
  <figure className="space-y-1">
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {src ? (
        <img src={src} alt={label} className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs text-gray-400">Зураг байхгүй</span>
      )}
    </div>
    <figcaption className="text-xs text-gray-500">{label}</figcaption>
  </figure>
);

// Session-ий үр дүнг Didit-ээс авна. Алдаа гарвал null (хадгалсан мэдээллээр харуулна).
async function loadDecision(sessionId) {
  if (!sessionId) return null;
  try {
    return await getDecision(sessionId);
  } catch (error) {
    console.error(`[didit] decision ${sessionId}:`, error.message);
    return null;
  }
}

const VerificationDetailPage = async ({ params }) => {
  const { session, organization, accessError } = await requireOrganizationPage();
  if (accessError) return <AccessDenied error={accessError} />;

  const { id } = await params;
  const verification = await prisma.identityVerification.findFirst({
    where: { id, ...organizationScope(session, organization) },
    include: {
      user: { select: { firstName: true, lastName: true } },
      organization: { select: { name: true } },
    },
  });
  if (!verification) notFound();

  const [documentDecision, faceDecision, registryChecks] = await Promise.all([
    loadDecision(verification.documentSessionId),
    loadDecision(verification.faceMatchSessionId),
    prisma.registryCheck.findMany({
      where: { verificationId: verification.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const document = documentDecision?.id_verifications?.[0];
  const face = faceDecision?.face_matches?.[0];
  const imagesMissing =
    (verification.documentSessionId && !documentDecision) || (verification.faceMatchSessionId && !faceDecision);

  // Уншсан мэдээллээр хоригийн жагсаалттай тулгах
  const matchQuery = new URLSearchParams(
    Object.entries({
      name: verification.fullName,
      birthDate: verification.dateOfBirth,
      subjectType: "INDIVIDUAL",
    }).filter(([, value]) => value),
  );
  const v = verification;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <TextLink href="/organizations/verifications">← Бүх баталгаажуулалт</TextLink>
          <div className="flex flex-wrap items-center gap-3">
            <PageTitle title={v.fullName ?? "Нэр уншигдаагүй"} />
            <StatusBadge status={v.status} statuses={VERIFICATION_STATUSES} />
          </div>
          <p className="text-sm text-gray-500">
            {formatDateTime(v.createdAt)}
            {v.user && ` · ${personName(v.user)}`}
            {v.organization && ` · ${v.organization.name}`}
          </p>
        </div>
        {v.fullName && (
          <ButtonLink variant="primary" href={`/organizations/match?${matchQuery}`}>
            Хоригийн жагсаалттай тулгах
          </ButtonLink>
        )}
      </div>

      {imagesMissing && (
        <Message error="Didit-ээс session-ий үр дүнг (зургийг) авч чадсангүй. Хадгалсан мэдээллийг харуулж байна." />
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card title="Бичиг баримт">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Шалгалт:</span>
            <StatusBadge status={v.documentStatus} statuses={CHECK_STATUSES} fallback="Хийгдээгүй" />
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Баримтын төрөл" value={v.documentType} />
            <Field label="Баримтын дугаар" value={v.documentNumber} />
            <Field label="Регистр / хувийн дугаар" value={v.personalNumber} />
            <Field label="Овог" value={v.lastName} />
            <Field label="Нэр" value={v.firstName} />
            <Field label="Төрсөн огноо" value={v.dateOfBirth} />
            <Field label="Хүйс" value={GENDERS[v.gender] ?? v.gender} />
            <Field label="Иргэншил" value={v.nationality} />
            <Field label="Олгосон улс" value={v.issuingState} />
            <Field label="Олгосон огноо" value={v.dateOfIssue} />
            <Field label="Хүчинтэй хугацаа" value={v.expirationDate} />
            <Field label="Хаяг" value={v.address} />
          </dl>
          <div className="grid grid-cols-3 gap-3">
            <DiditImage src={document?.portrait_image} label="Баримтын зураг" />
            <DiditImage src={document?.front_image} label="Нүүр тал" />
            <DiditImage src={document?.back_image} label="Ар тал" />
          </div>
        </Card>

        <Card title="Нүүр тулгалт" description="Баримт бичиг дээрх зургийг сельфитэй харьцуулсан үр дүн.">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Шалгалт:</span>
            <StatusBadge status={v.faceMatchStatus} statuses={CHECK_STATUSES} fallback="Хийгдээгүй" />
          </div>
          {v.faceMatchScore != null && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Төстэй байдал</span>
                <span className="font-semibold">
                  {v.faceMatchScore.toFixed(1)}% <span className="font-normal text-gray-500">(босго {v.faceMatchThreshold}%)</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-gray-100">
                <div
                  className={`h-2 rounded-full ${v.faceMatchStatus === "Approved" ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, v.faceMatchScore)}%` }}
                />
                <div className="absolute -top-1 h-4 w-0.5 bg-gray-700" style={{ left: `${v.faceMatchThreshold}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <DiditImage src={face?.source_image} label="Баримт бичгийн зураг" />
            <DiditImage src={face?.target_image} label="Сельфи" />
          </div>
        </Card>
      </div>

      <RegistryPanel verification={v} checks={registryChecks} configured={isXypConfigured()} />

      <Card title="Анхааруулга" description="Didit-ийн шалгалтаар илэрсэн асуудлууд. Улаан нь татгалзах шалтгаан болсон.">
        {v.warnings.length === 0 ? (
          <p className="text-sm text-green-700">Асуудал илрээгүй</p>
        ) : (
          <ul className="space-y-2">
            {v.warnings.map((warning, index) => (
              <li
                key={index}
                className={`rounded-lg p-3 text-sm ${warning.logType === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
              >
                <p className="font-medium">
                  {warning.description} <span className="font-mono text-xs opacity-70">{warning.risk}</span>
                </p>
                {warning.details && <p className="mt-1 text-xs opacity-80">{warning.details}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-gray-400">
        Didit session: {v.documentSessionId ?? "—"} (баримт), {v.faceMatchSessionId ?? "—"} (нүүр тулгалт)
      </p>
    </>
  );
};

export default VerificationDetailPage;
