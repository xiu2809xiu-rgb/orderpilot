import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/workflows", key: "inbox", end: true },
  { to: "/workflows/reminders", key: "reminders", end: false },
] as const;

/** Moves between the inbox and the reminders. Links, not tabs: each is its own page. */
export function WorkflowNav() {
  const { t } = useTranslation("workflows");
  return (
    <nav aria-label={t("nav.label")} className="flex gap-2">
      {LINKS.map((link) => (
        <NavLink
          key={link.key}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-accent",
            )
          }
        >
          {t(`nav.${link.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
