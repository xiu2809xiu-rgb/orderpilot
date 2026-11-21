import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
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

  // The same section as its neighbours on the settings page, so the card keeps
  // its look wherever it is mounted and needs no rules from the shell.
  return (
    <Section
      title={t("analyticsSettings.title")}
      intro={t("analyticsSettings.hint")}
    >
      <div className="space-y-s2">
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
          className="flex flex-wrap gap-3"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={chosen === option.value}
              disabled={option.disabled}
              onClick={option.pick}
              className="dx-choice disabled:cursor-not-allowed disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
