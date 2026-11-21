import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** The OrderPilot mark and name, at the top of the panel. The mark stays when the panel is a rail. */
export function Brand({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect
          width="32"
          height="32"
          className="fill-primary"
          style={{ rx: "calc(var(--radius-card) * 0.75)" }}
        />
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
      <span className={cn("fs-16", collapsed && "sr-only")}>
        {t("app.name")}
      </span>
    </span>
  );
}
