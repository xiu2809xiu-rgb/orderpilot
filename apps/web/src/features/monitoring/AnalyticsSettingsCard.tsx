import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSavedChoice } from "./consentCard";
import { tracker, useConsent } from "./tracker";

/** Settings: the one place to read or change the analytics choice at any time. */
export default function AnalyticsSettingsCard() {
  const { t } = useTranslation("monitoring");
  const consent = useConsent();
  const saved = useSavedChoice();

  let current = t("analyticsSettings.unset");
  if (consent === "granted") current = t("analyticsSettings.allowed");
  if (consent === "denied") current = t("analyticsSettings.declined");
  if (consent === "blocked") {
    current =
      saved === "granted"
        ? t("analyticsSettings.overriddenYes")
        : t("analyticsSettings.overridden");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("analyticsSettings.title")}
        </CardTitle>
        <p className="text-muted-foreground">{t("analyticsSettings.hint")}</p>
      </CardHeader>
      <CardContent className="space-y-s2">
        <p>
          <span className="text-muted-foreground">
            {t("analyticsSettings.current")}:{" "}
          </span>
          <span data-testid="analytics-current">{current}</span>
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={consent === "granted" ? "default" : "outline"}
            aria-pressed={consent === "granted"}
            disabled={consent === "blocked"}
            onClick={() => {
              tracker.grant();
            }}
          >
            {t("analyticsSettings.allow")}
          </Button>
          <Button
            size="sm"
            variant={consent === "denied" ? "default" : "outline"}
            aria-pressed={consent === "denied"}
            onClick={() => {
              tracker.deny();
            }}
          >
            {t("analyticsSettings.decline")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
