import type { PersonAvailability, Role } from "@orderpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./overlays/dropdown-menu";
import { demoLogin, fetchAuthOptions } from "@/lib/api/auth";
import { anyFormDirty } from "@/lib/dirty-forms";
import { useAvailabilityOf } from "@/lib/useAvailabilityOf";
import { useSessionStore } from "@/stores/session";
import { splitDemoRoles, type DemoRole } from "../demoRoles";
import { RoleItem } from "./RoleItem";
import { announceStay, landingAfterSwitch, startAsNewRole } from "./roleSwitch";

// Only needed when someone switches over unsaved input.
const RoleSwitchDialog = lazy(() =>
  import("./RoleSwitchDialog").then((m) => ({ default: m.RoleSwitchDialog })),
);

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

  // Each offered account's availability, so the menu can say who is Focusing
  // or on Do not disturb. Only accounts the server named by id are asked about.
  const ids =
    options.data?.demoRoles.flatMap((entry) =>
      entry.userId ? [entry.userId] : [],
    ) ?? [];
  const availability = useAvailabilityOf(ids, {
    enabled: options.data?.demoMode === true,
  });

  // The role asked for while the question is open.
  const [asking, setAsking] = useState<Role | null>(null);
  // The Demo role button: every close of the question returns focus to it.
  const trigger = useRef<HTMLButtonElement>(null);
  // Loaded on the first ask, then kept so that closing can return focus.
  const [askedOnce, setAskedOnce] = useState(false);

  if (!options.data?.demoMode) return null;

  async function switchTo(role: Role) {
    if (role === current) return;
    const session = await demoLogin(role);
    // The sign-in has emptied the query cache already; this drops what is kept beside it.
    await startAsNewRole(queryClient);
    const landing = landingAfterSwitch(pathname, session);
    // Staying put needs no navigation: the sign-in's reset already redraws the page.
    if (landing !== pathname) await navigate(landing);
    else announceStay(pathname);
  }

  // A switch drops what forms and reviews hold, so unsaved input is asked about first.
  function pick(role: Role) {
    if (role === current) return;
    if (anyFormDirty()) {
      setAskedOnce(true);
      setAsking(role);
    } else void switchTo(role);
  }

  const { flow, more } = splitDemoRoles(options.data.demoRoles);
  const shown = (entry: DemoRole): PersonAvailability | undefined => {
    const value = entry.userId
      ? availability.byId.get(entry.userId.toLowerCase())?.value
      : undefined;
    return value === "FOCUSING" || value === "DO_NOT_DISTURB"
      ? value
      : undefined;
  };

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          // What it shows is read when it is seen: the options are kept for 5
          // minutes, and after a reseed their ids would all answer Available.
          if (!open) return;
          void options.refetch();
          void availability.refetch();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            variant="outline"
            size="sm"
            className="dx-bar-role"
          >
            <UserCog aria-hidden="true" />
            {/* Icon only on a phone, so the trail keeps room for the record number. */}
            <span className="max-sm:sr-only">{t("demo.switcher")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={14} className="w-96">
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
              availability={shown(entry)}
              onPick={pick}
            />
          ))}
          {more.length > 0 ? <DropdownMenuSeparator /> : null}
          {more.map((entry) => (
            <RoleItem
              key={entry.role}
              entry={entry}
              current={entry.role === current}
              availability={shown(entry)}
              onPick={pick}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {askedOnce ? (
        <Suspense fallback={null}>
          <RoleSwitchDialog
            open={asking !== null}
            returnFocusTo={trigger}
            onStay={() => {
              setAsking(null);
            }}
            onSwitch={() => {
              const role = asking;
              setAsking(null);
              if (role) void switchTo(role);
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
