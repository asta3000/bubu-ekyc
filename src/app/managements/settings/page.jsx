import { annualPlanSettings } from "@/lib/billing/annual-plan";
import { freeRenewalLimit } from "@/lib/billing/free-plan";
import { secondReferralRate } from "@/lib/billing/referrals";
import { uncontractedUserLimit } from "@/lib/organizations";
import { getMatchingConfig } from "@/lib/screening/matching-settings";
import { getSystemSettings } from "@/lib/system";
import { requireAdminPage } from "@/lib/session";
import { ReportTabs } from "@/components/Reports";
import { PageTitle } from "@/components/Titles";
import AnnualPlanSettings from "./annual-plan-settings";
import MatchingSettings from "./matching-settings";
import FreePlanSettings from "./free-plan-settings";
import ReferralSettings from "./referral-settings";
import RegistrationSettings from "./registration-settings";
import SettingsForm from "./settings-form";

export const metadata = { title: "Тохиргоо" };

// Дэд цэс: ?section=contact | params | matching
const SECTIONS = [
  { key: "contact", label: "Холбоо барих мэдээлэл" },
  { key: "params", label: "Параметр утгууд" },
  { key: "matching", label: "Хориг тулгалтын оноо" },
];

// Системийн ерөнхий болон холбоо барих мэдээлэл (хэвлэх тайлан, баримтын толгойд)
const ContactSection = async () => {
  const settings = await getSystemSettings();
  return (
    <SettingsForm
      settings={{
        purpose: settings?.purpose ?? "",
        website: settings?.website ?? "",
        email: settings?.email ?? "",
        phone: settings?.phone ?? "",
        address: settings?.address ?? "",
        linkedin: settings?.linkedin ?? "",
        facebook: settings?.facebook ?? "",
        instagram: settings?.instagram ?? "",
      }}
    />
  );
};

// Бүртгэл, үнэгүй багц, жилийн багц, санал болголтын урамшууллын тоон утгууд
const ParamsSection = async () => {
  const [userLimit, freeLimit, annual, secondRate] = await Promise.all([
    uncontractedUserLimit(),
    freeRenewalLimit(),
    annualPlanSettings(),
    secondReferralRate(),
  ]);
  return (
    <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
      <RegistrationSettings uncontractedUserLimit={userLimit} />
      <FreePlanSettings freeRenewalLimit={freeLimit} />
      <AnnualPlanSettings discountRate={annual.discountRate} durationDays={annual.durationDays} />
      <ReferralSettings secondRate={secondRate} />
    </div>
  );
};

const MatchingSection = async () => <MatchingSettings initial={await getMatchingConfig()} />;

const CONTENT = { contact: ContactSection, params: ParamsSection, matching: MatchingSection };

const SettingsPage = async ({ searchParams }) => {
  await requireAdminPage();
  const { section } = await searchParams;
  const active = CONTENT[section] ? section : SECTIONS[0].key;
  const Section = CONTENT[active];

  return (
    <div className="space-y-4">
      <PageTitle title="Тохиргоо" description="Холбоо барих мэдээлэл, системийн параметр утгууд, хориг тулгалтын оноо" />
      <ReportTabs tabs={SECTIONS} active={active} param="section" />
      <Section />
    </div>
  );
};

export default SettingsPage;
