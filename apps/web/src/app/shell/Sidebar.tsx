import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { featureNamespaces, groupedMenu, menuFor } from "@/features/nav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { Logo } from "../Logo";
import { MenuLink } from "./MenuLink";

const settingsClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
  );

/**
 * The menu for the signed-in role: its modules, and in each only the screens
 * that exist and that its permissions open. Home has no heading above it.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation(["common", ...featureNamespaces]);
  const session = useSessionStore((state) => state.session);
  const modules = groupedMenu(menuFor(session));

  return (
    <nav
      aria-label={t("shell.primaryNav")}
      className="flex flex-1 flex-col gap-s3 overflow-y-auto px-s1 pb-s2"
    >
      {modules.map(({ module, entries }) => (
        <section
          key={module}
          aria-label={module === "home" ? t("nav.modules.home") : undefined}
          aria-labelledby={
            module === "home" ? undefined : `nav-module-${module}`
          }
        >
          {module === "home" ? null : (
            <h2
              id={`nav-module-${module}`}
              className="px-3 pb-1 text-xs font-medium text-muted-foreground"
            >
              {t(`nav.modules.${module}`)}
            </h2>
          )}
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li key={entry.id}>
                <MenuLink entry={entry} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="mt-auto space-y-1">
        <li>
          <NavLink
            to="/settings"
            className={settingsClass}
            onClick={onNavigate}
          >
            <Settings className="size-4" aria-hidden="true" />
            {t("nav.settings")}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

/** The fixed sidebar for wide screens. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center px-s2">
        <Logo />
      </div>
      <SidebarNav />
    </aside>
  );
}
