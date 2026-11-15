import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

  // The choice that stands. Do Not Track overrides it, but the saved choice
  // still shows, so a person sees what they picked.
  const chosen = consent === "blocked" ? saved : consent;
  const options = [
    {
      value: "granted",
      label: t("analyticsSettings.allow"),
      pick: () => {
        tracker.grant();
      },
      disabled: consent === "blocked",
    },
    {
      value: "denied",
      label: t("analyticsSettings.decline"),
      pick: () => {
        tracker.deny();
      },
      disabled: false,
    },
  ] as const;

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
        {/* Drawn as the Appearance choice is: the chosen one is marked as
            selected, not filled in as a button that asks to be pressed. */}
        <div
          role="radiogroup"
          aria-label={t("analyticsSettings.choiceLabel")}
          className="flex gap-2"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={chosen === option.value}
              disabled={option.disabled}
              onClick={option.pick}
              className={cn(
                "flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11",
                chosen === option.value
                  ? "border-primary bg-accent text-accent-foreground"
                  : "hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
