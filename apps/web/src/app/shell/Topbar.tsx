import { Menu, Search } from "lucide-react";
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
} from "@/components/ui/sheet";
import { Breadcrumbs } from "./Breadcrumbs";
import { Notifications } from "./Notifications";
import { RoleSwitcher } from "./RoleSwitcher";
import { SidebarNav } from "./Sidebar";
import { ThemeSwitch } from "./ThemeSwitch";
import { UserMenu } from "./UserMenu";

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-s1 border-b bg-background px-s2">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t("shell.openMenu")}
          >
            <Menu className="size-4" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("shell.mobileNavTitle")}</SheetTitle>
            <SheetDescription>
              {t("shell.mobileNavDescription")}
            </SheetDescription>
          </SheetHeader>
          <div className="pt-s5">
            <SidebarNav
              onNavigate={() => {
                setMenuOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="hidden w-52 justify-start font-normal text-muted-foreground sm:inline-flex"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={onOpenPalette}
      >
        <Search aria-hidden="true" />
        <span className="flex-1 text-left">{t("shell.search")}</span>
        <kbd
          className="rounded border bg-muted px-1.5 font-mono text-xs"
          aria-hidden="true"
        >
          {t("palette.keys")}
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        aria-label={t("shell.search")}
        onClick={onOpenPalette}
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>
      <RoleSwitcher />
      <Notifications />
      <ThemeSwitch />
      <UserMenu />
    </header>
  );
}
