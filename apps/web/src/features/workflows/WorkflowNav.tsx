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
    // Drawn like the tabs elsewhere, so the two places read as one page with two views.
    <nav
      aria-label={t("nav.label")}
      className="inline-flex gap-1 rounded-lg bg-muted p-1"
    >
      {LINKS.map((link) => (
        <NavLink
          key={link.key}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {t(`nav.${link.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
