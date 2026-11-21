import { useTranslation } from "react-i18next";
import { Link, matchPath, useLocation } from "react-router";
// Links are not the Tabs component, so they bring the tab look themselves.
import "@/components/ui/tabs.css";

const LINKS = [
  { to: "/workflows", key: "inbox", end: true },
  { to: "/workflows/reminders", key: "reminders", end: false },
] as const;

/**
 * Moves between the inbox and the reminders. They are links, not tabs, because
 * each is its own page; they wear the shared pill tabs so the strip reads like
 * the other tabs of the app. The open one says so with `aria-current` and with
 * the `data-state` the tab look is drawn from.
 */
export function WorkflowNav() {
  const { t } = useTranslation("workflows");
  const { pathname } = useLocation();
  return (
    <nav aria-label={t("nav.label")} className="tabs-list">
      {LINKS.map((link) => {
        const active = matchPath({ path: link.to, end: link.end }, pathname);
        return (
          <Link
            key={link.key}
            to={link.to}
            aria-current={active ? "page" : undefined}
            data-state={active ? "active" : "inactive"}
            className="tabs-trigger"
          >
            {t(`nav.${link.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
