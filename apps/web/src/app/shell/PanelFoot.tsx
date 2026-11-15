import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { PanelHelp } from "./PanelHelp";
import { RailTip } from "./RailTip";

/**
 * The last rows of the menu: settings and help. They never scroll and never
 * move; only the groups above them give way. They sit inside the navigation
 * landmark, because Settings is a page of the menu like any other.
 */
export function PanelFoot({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="dx-foot flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border pt-2">
      <li>
        <RailTip
          show={collapsed}
          tip={<span className="block font-medium">{t("nav.settings")}</span>}
        >
          <NavLink to="/settings" onClick={onNavigate} className="dx-entry">
            <Settings className="size-[18px] shrink-0" aria-hidden="true" />
            <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>
              {t("nav.settings")}
            </span>
          </NavLink>
        </RailTip>
      </li>
      <li>
        <PanelHelp collapsed={collapsed} />
      </li>
    </ul>
  );
}
