import { Menu, PanelLeft, Sparkles, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ThemeSwitch } from "@/app/shell/ThemeSwitch";
import { Notifications } from "@/app/shell/Notifications";
import { Button } from "@/components/ui/button";
import { isBuilt, screenPath, type ScreenId } from "../screens";
import { Crumbs } from "./Crumbs";
import { RoleSwitch } from "./RoleSwitch";
import { SearchField } from "./SearchField";
import { useSparkPanel } from "./sparkPanel";
import { TopBarAction } from "./TopBarAction";

interface TopBarProps {
  screen: ScreenId;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMenu: () => void;
}

/**
 * The top bar: where you are, search and jump (Ctrl K), Upload, Spark, the
 * bell, the demo role and the theme. It stands still when the screen changes.
 */
export function TopBar({
  screen,
  collapsed,
  onToggleCollapsed,
  onOpenMenu,
}: TopBarProps) {
  const { t } = useTranslation("directions");
  const spark = useSparkPanel();
  return (
    <header className="dx-bar relative z-20 flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t("panel.openMenu")}
        onClick={onOpenMenu}
      >
        <Menu aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        aria-label={collapsed ? t("panel.expand") : t("panel.collapse")}
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        <PanelLeft aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <Crumbs screen={screen} />
      </div>
      <SearchField />
      <TopBarAction
        icon={Upload}
        label={t("bar.upload")}
        to={isBuilt("upload") ? screenPath("upload") : undefined}
        unavailable={isBuilt("upload") ? undefined : t("bar.uploadNote")}
      />
      <TopBarAction
        icon={Sparkles}
        label={t("bar.spark")}
        onClick={() => {
          spark.setOpen(true);
        }}
        unavailable={spark.available ? undefined : t("spark.note")}
        shortcut="Control+. Meta+."
      />
      <Notifications />
      <RoleSwitch />
      <div className="max-sm:hidden">
        <ThemeSwitch />
      </div>
    </header>
  );
}
