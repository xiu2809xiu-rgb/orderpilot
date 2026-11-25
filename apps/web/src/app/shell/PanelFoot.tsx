import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { WAITING_COUNT_API } from "@/lib/pictures/waitingCount";
import { useListCount } from "@/lib/useListCount";
import { cn } from "@/lib/utils";
import { hasPermission, useSessionStore } from "@/stores/session";
import { CountBadge } from "./CountBadge";
import { PanelHelp } from "./PanelHelp";
import { RailTip } from "./RailTip";

/**
 * The last rows of the menu: settings and help. They never scroll and never
 * move; only the groups above them give way. They sit inside the navigation
 * landmark, because Settings is a page of the menu like any other.
 *
 * Settings carries the number of profile pictures that wait for the person's
 * review, because it is the only way into that list and nothing else tells a
 * reviewer that one is waiting. A role that may not review asks for nothing.
 */
export function PanelFoot({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const waiting =
    useListCount(WAITING_COUNT_API, hasPermission(session, "users.manage"))
      .data ?? 0;
  return (
    <ul className="dx-foot flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border pt-2">
      <li>
        <RailTip
          show={collapsed}
          tip={
            <>
              <span className="block font-medium">{t("nav.settings")}</span>
              {waiting > 0 ? (
                <span className="numeral block">
                  {t("nav.waiting", { count: waiting })}
                </span>
              ) : null}
            </>
          }
        >
          <NavLink to="/settings" onClick={onNavigate} className="dx-entry">
            <Settings className="size-[18px] shrink-0" aria-hidden="true" />
            <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>
              {t("nav.settings")}
            </span>
            {waiting > 0 ? (
              collapsed ? (
                <>
                  <span className="sr-only">
                    {t("nav.waiting", { count: waiting })}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-3 size-2 rounded-full bg-primary"
                  />
                </>
              ) : (
                <CountBadge className="ml-auto" size="sm">
                  {waiting > 99 ? "99+" : waiting.toLocaleString("en")}
                  <span className="sr-only"> {t("nav.waitingWord")}</span>
                </CountBadge>
              )
            ) : null}
          </NavLink>
        </RailTip>
      </li>
      <li>
        <PanelHelp collapsed={collapsed} />
      </li>
    </ul>
  );
}
