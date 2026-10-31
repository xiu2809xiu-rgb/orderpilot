import { useTranslation } from "react-i18next";

/** The OrderPilot mark and name. The mark is the same drawing as the favicon. */
export function Logo() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M9 10.5 16 7l7 3.5v8L16 22l-7-3.5z"
          fill="none"
          className="stroke-primary-foreground"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9 10.5 16 14l7-3.5M16 14v8"
          fill="none"
          className="stroke-primary-foreground"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity=".7"
        />
      </svg>
      <span className="text-base">{t("app.name")}</span>
    </span>
  );
}
