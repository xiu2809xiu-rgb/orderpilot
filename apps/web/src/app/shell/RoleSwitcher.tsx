import type { Role } from "@orderpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Route, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
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
import { startAsNewRole } from "./roleSwitch";

/** Shown only when GET /auth/options says demo mode is on. */
export function RoleSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    await demoLogin(role);
    // Another role sees other data: nothing of the old role may stay on screen.
    await startAsNewRole(queryClient);
    await navigate("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="dx-bar-role">
          <UserCog aria-hidden="true" />
          {/* Icon only on a phone, so the trail keeps room for the record number. */}
          <span className="max-sm:sr-only">{t("demo.switcher")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={14} className="w-64">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {t("demo.switcherHint")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.data.demoRoles.map(({ role, displayName }) => (
          <DropdownMenuItem
            key={role}
            onSelect={() => {
              void switchTo(role);
            }}
          >
            <span className="flex-1">
              <span className="block">{t(`roles.${role}`)}</span>
              <span className="block text-xs text-muted-foreground">
                {displayName}
              </span>
            </span>
            {role === current ? (
              <Check className="size-4" aria-label={t("demo.current")} />
            ) : null}
          </DropdownMenuItem>
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
