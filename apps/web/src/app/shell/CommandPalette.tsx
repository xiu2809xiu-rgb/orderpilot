import { Home, Settings } from "lucide-react";
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
import { actionsFor, type AppAction } from "@/lib/actions";
import { useSessionStore } from "@/stores/session";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

/** What the keyboard can do, always visible under the list. */
function ShortcutHelp() {
  const { t } = useTranslation("common");
  return (
    <ul
      aria-label={t("palette.helpLabel")}
      className="flex flex-wrap gap-x-s3 gap-y-1 border-t px-s2 py-s1 text-xs text-muted-foreground"
    >
      <li className="flex items-center gap-1.5">
        <Key>/</Key> {t("palette.helpSearch")}
      </li>
      <li className="flex items-center gap-1.5">
        <Key>N</Key> {t("palette.helpNew")}
      </li>
      <li className="flex items-center gap-1.5">
        <Key>Ctrl K</Key> {t("palette.helpPalette")}
      </li>
    </ul>
  );
}

/**
 * The command palette. AppShell opens it with Control K or Command K. It runs
 * actions (registered with `registerAction`, filtered by the session's
 * permissions) above the list of places to go.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation(["common", "components", ...featureNamespaces]);
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);

  function go(path: string) {
    onOpenChange(false);
    void navigate(path);
  }

  function run(action: AppAction) {
    onOpenChange(false);
    void action.run({
      navigate: (to) => {
        void navigate(to);
      },
    });
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
        <CommandGroup heading={t("palette.actions")}>
          {actionsFor(session).map((action) => {
            const label = t(action.label, {
              ns: action.namespace ?? "common",
              defaultValue: action.label,
            });
            return (
              <CommandItem
                key={action.id}
                value={label}
                keywords={[...(action.keywords ?? [])]}
                onSelect={() => {
                  run(action);
                }}
              >
                <action.icon aria-hidden="true" />
                {label}
              </CommandItem>
            );
          })}
        </CommandGroup>
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
      </CommandList>
      <ShortcutHelp />
    </CommandDialog>
  );
}
