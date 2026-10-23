import { getMatchingConfig } from "@/lib/screening/matching-settings";
import { getSystemSettings } from "@/lib/system";
import { requireAdminPage } from "@/lib/session";
import { PageTitle } from "@/components/Titles";
import MatchingSettings from "./matching-settings";
import SettingsForm from "./settings-form";

export const metadata = { title: "Тохиргоо" };

const SettingsPage = async () => {
  await requireAdminPage();
  const [settings, matching] = await Promise.all([getSystemSettings(), getMatchingConfig()]);

  return (
    <div className="space-y-6">
      <PageTitle title="Тохиргоо" description="Системийн ерөнхий мэдээлэл, хориг тулгалтын оноо" />
      <SettingsForm
        settings={{
          purpose: settings?.purpose ?? "",
          website: settings?.website ?? "",
          email: settings?.email ?? "",
          phone: settings?.phone ?? "",
          address: settings?.address ?? "",
        }}
      />
      <h2 className="pt-2 text-lg font-semibold">Хориг тулгалтын оноо</h2>
      <MatchingSettings initial={matching} />
    </div>
  );
};

export default SettingsPage;
