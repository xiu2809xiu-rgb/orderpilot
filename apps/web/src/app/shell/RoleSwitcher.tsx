import type { Role } from "@orderpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Route, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./overlays/dropdown-menu";
import { demoLogin, fetchAuthOptions } from "@/lib/api/auth";
import { useDemoTour } from "@/stores/demoTour";
import { useSessionStore } from "@/stores/session";
import { splitDemoRoles, type DemoRole } from "../demoRoles";
import { landingAfterSwitch, startAsNewRole } from "./roleSwitch";

/** One role in the menu: its number when it has one, the team, the person and what the team does. */
function RoleItem({
  entry,
  step,
  current,
  onPick,
}: {
  entry: DemoRole;
  step?: number;
  current: boolean;
  onPick: (role: Role) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenuItem
      onSelect={() => {
        onPick(entry.role);
      }}
    >
      {step === undefined ? null : (
        <span
          aria-hidden="true"
          className="fs-12 grid size-5 shrink-0 place-items-center self-start rounded-full bg-accent font-semibold text-accent-foreground tabular-nums"
        >
          {step}
        </span>
      )}
      <span className="flex-1">
        <span className="block">{t(`roles.${entry.role}`)}</span>
        <span className="block text-xs text-foreground">
          {entry.displayName}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t(`demo.jobs.${entry.role}`)}
        </span>
      </span>
      {current ? (
        <Check className="size-4" aria-label={t("demo.current")} />
      ) : null}
    </DropdownMenuItem>
  );
}

/** Shown only when GET /auth/options says demo mode is on. */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const current = useSessionStore((state) => state.session?.user.role);
  const options = useQuery({
    queryKey: ["auth", "options"],
    queryFn: fetchAuthOptions,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!options.data?.demoMode) return null;

  async function switchTo(role: Role) {
    if (role === current) return;
    const session = await demoLogin(role);
    // Another role sees other data: nothing of the old role may stay on screen.
    await startAsNewRole(queryClient);
    const landing = landingAfterSwitch(pathname, session);
    // Staying put needs no navigation: the reset above already redraws the page.
    if (landing !== pathname) await navigate(landing);
  }

  const { flow, more } = splitDemoRoles(options.data.demoRoles);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="dx-bar-role">
          <UserCog aria-hidden="true" />
          {/* Icon only on a phone, so the trail keeps room for the record number. */}
          <span className="max-sm:sr-only">{t("demo.switcher")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={14} className="w-80">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {t("demo.switcherHint")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {flow.map((entry) => (
          <RoleItem
            key={entry.role}
            entry={entry}
            step={entry.step}
            current={entry.role === current}
            onPick={(role) => {
              void switchTo(role);
            }}
          />
        ))}
        {more.length > 0 ? <DropdownMenuSeparator /> : null}
        {more.map((entry) => (
          <RoleItem
            key={entry.role}
            entry={entry}
            current={entry.role === current}
            onPick={(role) => {
              void switchTo(role);
            }}
          />
        ))}
        <DropdownMenuSeparator />
        {/* The tour walks the sales flow across the roles above, on the sample data. */}
        <DropdownMenuItem
          onSelect={() => {
            useDemoTour.getState().start();
          }}
        >
          <Route aria-hidden="true" />
          {t("tour.start")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
