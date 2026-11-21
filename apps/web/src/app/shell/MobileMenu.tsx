import { Menu } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./overlays/sheet";
import { MobileExtras } from "./MobileExtras";
import { SidePanel } from "./SidePanel";

/** Below the md breakpoint the panel lives in a sheet, behind this button. */
export function MobileMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden dx-bar-icon"
          aria-label={t("shell.openMenu")}
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 gap-0 border-[var(--panel-border)] bg-popover p-0 text-popover-foreground"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("shell.mobileNavTitle")}</SheetTitle>
          <SheetDescription>{t("shell.mobileNavDescription")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <SidePanel collapsed={false} onNavigate={close} />
        </div>
        <MobileExtras onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}
