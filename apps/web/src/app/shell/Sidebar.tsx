import { Home, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import {
  featureNamespaces,
  featuresFor,
  groupedFeatures,
} from "@/features/nav";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { Logo } from "../Logo";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
  );

/** The menu for the signed-in role: only areas its permissions open. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation(["common", ...featureNamespaces]);
  const session = useSessionStore((state) => state.session);
  const groups = groupedFeatures(featuresFor(session));

  return (
    <nav
      aria-label={t("shell.primaryNav")}
      className="flex flex-1 flex-col gap-s3 overflow-y-auto px-s1 pb-s2"
    >
      <ul className="space-y-1">
        <li>
          <NavLink to="/" end className={linkClass} onClick={onNavigate}>
            <Home className="size-4" aria-hidden="true" />
            {t("nav.home")}
          </NavLink>
        </li>
      </ul>
      {groups.map(({ group, items }) => (
        <section key={group} aria-labelledby={`nav-group-${group}`}>
          <h2
            id={`nav-group-${group}`}
            className="px-3 pb-1 text-xs font-medium text-muted-foreground"
          >
            {t(`nav.groups.${group}`)}
          </h2>
          <ul className="space-y-1">
            {items.map((feature) => (
              <li key={feature.id}>
                <NavLink
                  to={`/${feature.path}`}
                  className={linkClass}
                  onClick={onNavigate}
                >
                  <feature.icon className="size-4" aria-hidden="true" />
                  {t("title", { ns: feature.namespace })}
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ul className="mt-auto space-y-1">
        <li>
          <NavLink to="/settings" className={linkClass} onClick={onNavigate}>
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
