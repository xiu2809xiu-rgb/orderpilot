import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Direction } from "../directions";
import type { ScreenId } from "../screens";
import { SidePanel } from "./SidePanel";

/** The same panel in a sheet, below the md breakpoint. */
export function MobileMenu({
  direction,
  screen,
  open,
  onOpenChange,
}: {
  direction: Direction;
  screen: ScreenId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("directions");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        // Focus the sheet, not its first row: that row may be a plain one
        // whose tooltip would open on arrival.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.focus();
          }
        }}
        className="w-72 gap-0 border-[var(--panel-border)] bg-popover p-0 text-popover-foreground"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("panel.menuTitle")}</SheetTitle>
          <SheetDescription>{t("panel.menuDescription")}</SheetDescription>
        </SheetHeader>
        <SidePanel
          direction={direction}
          screen={screen}
          collapsed={false}
          onNavigate={() => {
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
