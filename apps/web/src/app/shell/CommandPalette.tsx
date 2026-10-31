import { Home, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { featureNamespaces, featuresFor } from "@/features/nav";
import { logout } from "@/lib/api/auth";
import { useThemeStore, type ThemePreference } from "@/lib/theme";
import { useSessionStore } from "@/stores/session";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The command palette. AppShell opens it with Control K or Command K. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation(["common", ...featureNamespaces]);
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const setPreference = useThemeStore((state) => state.setPreference);

  function go(path: string) {
    onOpenChange(false);
    void navigate(path);
  }

  function chooseTheme(preference: ThemePreference) {
    onOpenChange(false);
    setPreference(preference);
  }

  function signOut() {
    onOpenChange(false);
    void logout().then(() => navigate("/login"));
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("palette.title")}
      description={t("palette.description")}
    >
      <CommandInput placeholder={t("palette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("palette.empty")}</CommandEmpty>
        <CommandGroup heading={t("palette.goTo")}>
          <CommandItem
            onSelect={() => {
              go("/");
            }}
          >
            <Home aria-hidden="true" />
            {t("nav.home")}
          </CommandItem>
          {featuresFor(session).map((feature) => (
            <CommandItem
              key={feature.id}
              onSelect={() => {
                go(`/${feature.path}`);
              }}
            >
              <feature.icon aria-hidden="true" />
              {t("title", { ns: feature.namespace })}
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() => {
              go("/settings");
            }}
          >
            <Settings aria-hidden="true" />
            {t("nav.settings")}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t("palette.actions")}>
          <CommandItem
            onSelect={() => {
              chooseTheme("light");
            }}
          >
            <Sun aria-hidden="true" />
            {t("theme.light")}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              chooseTheme("dark");
            }}
          >
            <Moon aria-hidden="true" />
            {t("theme.dark")}
          </CommandItem>
          <CommandItem onSelect={signOut}>
            <LogOut aria-hidden="true" />
            {t("userMenu.signOut")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
