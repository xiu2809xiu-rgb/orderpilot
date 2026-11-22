import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/kit/Alert";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { Switch } from "@/components/ui/switch";
import { useSavedChoice } from "./consentCard";
import { tracker, useConsent } from "./tracker";

/**
 * Settings: the one place to read or change the analytics choice at any time.
 * One switch. When the browser sends Do Not Track or Global Privacy Control
 * nothing is counted whatever the switch says, so the card says that, and the
 * switch keeps showing the saved choice. The status line is for screen readers
 * and for tests: the visible answer is the switch itself.
 */
export default function AnalyticsSettingsCard() {
  const { t } = useTranslation("monitoring");
  const consent = useConsent();
  const saved = useSavedChoice();
  const blocked = consent === "blocked";

  // The choice that stands. Do Not Track overrides it, but the saved choice
  // still shows, so a person sees what they picked.
  const chosen = blocked ? saved : consent;
  // Turning it on would be refused while the browser asks not to be tracked.
  // A saved Allow can still be turned off.
  const disabled = blocked && saved !== "granted";

  let current = t("analyticsSettings.unset");
  if (consent === "granted") current = t("analyticsSettings.allowed");
  if (consent === "denied" || blocked) {
    current = t("analyticsSettings.declined");
  }

  return (
    <Section title={t("analyticsSettings.title")}>
      <SettingList>
        <SettingRow
          label={t("analyticsSettings.label")}
          description={t("analyticsSettings.hint")}
          control={({ labelId, descriptionId }) => (
            <Switch
              checked={chosen === "granted"}
              disabled={disabled}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              onCheckedChange={(on) => {
                if (on) tracker.grant();
                else tracker.deny();
              }}
            />
          )}
        >
          {blocked ? (
            <Alert variant="info">
              <AlertDescription>
                {t("analyticsSettings.blocked")}
              </AlertDescription>
            </Alert>
          ) : null}
        </SettingRow>
      </SettingList>
      <p className="sr-only" role="status" data-testid="analytics-current">
        {current}
      </p>
      <SettingFootnote>{t("analyticsSettings.footnote")}</SettingFootnote>
    </Section>
  );
}
