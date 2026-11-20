import { PanelLeft, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SparkButton } from "@/features/directions/spark/SparkButton";
import { Breadcrumbs } from "./Breadcrumbs";
import { MobileMenu } from "./MobileMenu";
import { Notifications } from "./Notifications";
import { RoleSwitcher } from "./RoleSwitcher";
import { SearchField } from "./SearchField";
import { useSparkPanel } from "./sparkPanel";
import { ThemeSwitch } from "./ThemeSwitch";
import { TopBarAction } from "./TopBarAction";
import { UPLOAD_PATH, useUploadEntry } from "./demoParts";

interface TopbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenPalette: () => void;
}

/**
 * The top bar: where you are, search and jump (Ctrl K), Upload, Spark, the
 * bell, the demo role and the theme. It stands still when the page changes.
 */
export function Topbar({
  collapsed,
  onToggleCollapsed,
  onOpenPalette,
}: TopbarProps) {
  const { t } = useTranslation();
  const mayUpload = useUploadEntry();
  const spark = useSparkPanel();
  return (
    <header className="dx-bar relative z-20 flex h-14 shrink-0 items-center gap-1 px-2 sm:gap-2 sm:px-4">
      <MobileMenu />
      <Button
        variant="ghost"
        size="icon"
        className="dx-bar-icon hidden md:inline-flex"
        aria-label={
          collapsed ? t("shell.expandPanel") : t("shell.collapsePanel")
        }
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        <PanelLeft aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <SearchField onOpen={onOpenPalette} />
      {mayUpload ? (
        <TopBarAction
          icon={Upload}
          label={t("shell.upload")}
          to={UPLOAD_PATH}
          // Home and Orders offer Upload too, so a phone keeps the room for the record number.
          className="max-[30rem]:hidden"
        />
      ) : null}
      {spark.available ? (
        <SparkButton
          open={spark.open}
          onToggle={() => {
            spark.setOpen(!spark.open);
          }}
        />
      ) : null}
      <Notifications />
      <RoleSwitcher />
      <div className="max-sm:hidden">
        <ThemeSwitch />
      </div>
    </header>
  );
}
