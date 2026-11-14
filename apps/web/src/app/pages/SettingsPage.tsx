import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/parts/PageHeader";
import { ServiceChecksCard } from "./ServiceChecksCard";
import { AccountSection } from "./settings/AccountSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { LanguageSection } from "./settings/LanguageSection";

// A separate chunk with the tracker, so the entry bundle does not grow.
const AnalyticsSettingsCard = lazy(
  () => import("@/features/monitoring/AnalyticsSettingsCard"),
);

/** Sections at a reading width: what a person can change comes first. */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="dx-settings max-w-3xl">
      <PageHeader
        title={t("settings.title")}
        intro={t("settings.description")}
      />
      <div className="flex flex-col gap-4">
        <AppearanceSection />
        <LanguageSection />
        <Suspense fallback={null}>
          <AnalyticsSettingsCard />
        </Suspense>
        <ServiceChecksCard />
        <AccountSection />
      </div>
    </div>
  );
}
