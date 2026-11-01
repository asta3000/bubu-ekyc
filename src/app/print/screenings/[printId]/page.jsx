import { Suspense } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { organizationLogoSrc } from "@/lib/blob";
import { formatDate, formatDateTime, personName } from "@/lib/format";
import { organizationScope, requireOrganizationPage } from "@/lib/organization-access";
import { entrySourceName, sanctionSource } from "@/lib/sanctions/sources";
import { countryLabel } from "@/lib/screening/countries";
import { documentNumber, loadPrint, printMatch, printVerifyUrl } from "@/lib/screening/prints";
import { getSystemInfo } from "@/lib/system";
import { AccessDenied, Loading } from "@/components/Messages";
import { CHECK_LABELS, SUBJECT_LABELS, scoreLevel } from "../../../organizations/_components/labels";
import PrintToolbar from "./print-toolbar";

// Нэг хуудсанд багтаахын тулд урт жагсаалтыг хязгаарлана
const MAX_ITEMS = { aliases: 8, addresses: 3, identifiers: 5, programs: 4 };
const MAX_REMARKS = 500;

const limited = (values, max) =>
  values?.length > max ? [...values.slice(0, max), `… өөр ${values.length - max}`] : values ?? [];

const Section = ({ title, children }) => (
  <section className="break-inside-avoid space-y-1.5">
    <h2 className="border-b border-gray-300 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-700">{title}</h2>
    {children}
  </section>
);

const Field = ({ label, value }) => (
  <div className="grid grid-cols-[34%_1fr] gap-2">
    <dt className="text-gray-500">{label}</dt>
    <dd className="break-words text-gray-900">{Array.isArray(value) ? value.join("; ") || "—" : value || "—"}</dd>
  </div>
);

const Fields = ({ children, columns = 1 }) => (
  <dl className={`grid gap-x-6 gap-y-0.5 ${columns === 2 ? "grid-cols-2" : ""}`}>{children}</dl>
);

const Person = ({ title, organization, user, extra }) => (
  <div className="space-y-1.5 rounded border border-gray-300 p-2">
    <p className="text-[10px] font-semibold uppercase text-gray-500">{title}</p>
    <div className="flex items-center gap-2">
      {organization && organizationLogoSrc(organization) ? (
        <img src={organizationLogoSrc(organization)} alt="" className="h-10 w-10 object-contain" />
      ) : null}
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{organization?.name ?? "—"}</p>
        <p className="text-gray-900">{personName(user)}</p>
        <p className="text-gray-600">{[user?.email, user?.contact].filter(Boolean).join(" · ")}</p>
        {extra && <p className="text-gray-600">{extra}</p>}
      </div>
    </div>
  </div>
);

const Signature = ({ title, name }) => (
  <div className="space-y-6">
    <p className="font-semibold text-gray-700">{title}</p>
    <div className="space-y-1">
      <div className="border-b border-gray-500" />
      <p className="text-gray-600">Гарын үсэг</p>
    </div>
    <p className="text-gray-900">Нэр: {name ?? "______________________________"}</p>
    <p className="text-gray-900">Огноо: ______________________</p>
  </div>
);

const PrintContent = async ({ params }) => {
  const { session, organization, accessError } = await requireOrganizationPage();
  if (accessError) return <AccessDenied error={accessError} />;

  const { printId } = await params;
  // Өөр байгууллагын тулгалтын хэвлэлтийг харуулахгүй
  const print = await loadPrint({ id: printId, screening: organizationScope(session, organization) });
  const match = print && printMatch(print);
  if (!match) notFound();

  const { screening } = print;
  const { entry, checks } = match;
  const level = scoreLevel(match.score);
  const system = await getSystemInfo();
  const qrSvg = await QRCode.toString(printVerifyUrl(print.id), { type: "svg", margin: 0, errorCorrectionLevel: "M" });

  return (
    <>
      <style>{"@page { size: A4; margin: 2cm; }"}</style>
      <PrintToolbar />
      <article className="mx-auto mb-8 w-[210mm] space-y-3 bg-white p-[2cm] text-[11px] leading-snug text-gray-900 shadow print:m-0 print:w-auto print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-2">
          <div>
            <p className="text-xl font-bold">
              e-<span className="text-blue-700">KYC</span>
            </p>
            <p className="text-gray-600">{system.purpose}</p>
          </div>
          <div className="text-right text-gray-600">
            {system.website && <p>{system.website}</p>}
            {system.email && <p>{system.email}</p>}
            {system.phone && <p>{system.phone}</p>}
            {system.address && <p className="max-w-[60mm]">{system.address}</p>}
          </div>
        </header>

        <div className="flex items-end justify-between">
          <h1 className="text-base font-bold">Хоригийн жагсаалттай тулгалтын тайлан</h1>
          <p className="text-right text-gray-600">
            Баримтын дугаар: <span className="font-mono font-semibold text-gray-900">{documentNumber(print)}</span>
            <br />
            Хэвлэсэн: {formatDateTime(print.createdAt)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Person title="Хэвлэсэн" organization={print.organization} user={print.user} />
          <Person
            title="Тулгалт хийсэн"
            organization={screening.organization}
            user={screening.user}
            extra={`Тулгасан: ${formatDateTime(screening.createdAt)}`}
          />
        </div>

        <Section title="Тулгалтын оролт">
          <Fields columns={2}>
            <Field label="Нэр" value={screening.name} />
            <Field label="Төрөл" value={SUBJECT_LABELS[screening.subjectType] ?? "Бүгд"} />
            <Field label="Төрсөн он/огноо" value={screening.birthDate} />
            <Field label="Улс" value={countryLabel(screening.country)} />
            <Field label="Бичиг баримт" value={screening.identifier} />
            <Field label="Тохирлын босго" value={`${screening.threshold}%`} />
          </Fields>
          <Fields>
            <Field label="Жагсаалтууд" value={screening.sources.map((key) => sanctionSource(key)?.name ?? key)} />
          </Fields>
        </Section>

        <Section title="Тулгалтын үр дүн">
          <Fields columns={2}>
            <Field label="Нийт тохирол" value={`${screening.matchCount} (энэ нь #${print.matchIndex + 1})`} />
            <Field label="Оноо" value={`${match.score} — ${level.label} эрсдэл`} />
            <Field label="Таарсан нэр" value={match.matchedName} />
            <Field label="Нэрийн тохирол" value={`${match.nameScore}%`} />
            <Field label="Төрсөн огноо" value={CHECK_LABELS[checks.birthDate]?.label} />
            <Field label="Улс" value={CHECK_LABELS[checks.country]?.label} />
            <Field label="Бичиг баримт" value={CHECK_LABELS[checks.identifier]?.label} />
          </Fields>
        </Section>

        <Section title="Тохирлын дэлгэрэнгүй">
          <Fields>
            <Field label="Нэр" value={entry.name} />
            <Field label="Жагсаалт" value={entry.source === "CUSTOM" ? entrySourceName(entry) : `${entrySourceName(entry)} · ${entry.externalId}`} />
            <Field label="Төрөл" value={SUBJECT_LABELS[entry.subjectType]} />
            <Field label="Өөр нэрс" value={limited(entry.aliases, MAX_ITEMS.aliases)} />
            <Field label="Төрсөн огноо" value={entry.birthDates} />
            <Field label="Төрсөн газар" value={entry.birthPlaces} />
            <Field label="Иргэншил" value={entry.nationalities} />
            <Field label="Хаяг" value={limited(entry.addresses, MAX_ITEMS.addresses)} />
            <Field label="Бичиг баримт" value={limited(entry.identifiers, MAX_ITEMS.identifiers)} />
            <Field label="Хөтөлбөр" value={limited(entry.programs, MAX_ITEMS.programs)} />
            <Field label="Жагсаалтад орсон" value={entry.listedAt ? formatDate(entry.listedAt) : null} />
            <Field
              label="Тайлбар"
              value={entry.remarks?.length > MAX_REMARKS ? `${entry.remarks.slice(0, MAX_REMARKS)}…` : entry.remarks}
            />
          </Fields>
        </Section>

        <footer className="grid break-inside-avoid grid-cols-[1fr_1fr_auto] items-end gap-6 border-t border-gray-300 pt-3">
          <Signature title="Хэвлэсэн ажилтан" name={personName(print.user)} />
          <Signature title="Хянаж баталгаажуулсан ажилтан" />
          <div className="w-24 space-y-1 text-center">
            <div className="h-24 w-24 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="text-[9px] leading-tight text-gray-600">Баримтын үнэн зөвийг утсаараа уншуулж шалгана уу</p>
          </div>
        </footer>
      </article>
    </>
  );
};

// Session, DB-г request үед уншдаг тул cacheComponents-д Suspense-д ороосон
const ScreeningPrintPage = ({ params }) => (
  <Suspense fallback={<Loading className="p-4" />}>
    <PrintContent params={params} />
  </Suspense>
);

export default ScreeningPrintPage;
