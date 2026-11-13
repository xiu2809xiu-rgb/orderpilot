import type { Role } from "@orderpilot/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { demoLogin, fetchAuthOptions } from "@/lib/api/auth";
import { useSessionStore } from "@/stores/session";

/**
 * Signs in as another demo role without leaving the screen, so the panel and
 * the screen show what that role sees. Only where the API offers demo roles.
 */
export function RoleSwitch() {
  const { t } = useTranslation(["directions", "common"]);
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
    // Another role sees other data: start from a clean cache.
    queryClient.clear();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fs-14 h-9 pointer-coarse:h-11"
        >
          <UserCog aria-hidden="true" />
          <span className="max-lg:sr-only">{t("bar.roleLabel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="fs-14 font-normal text-muted-foreground">
          {t("common:demo.switcherHint")}
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
              <span className="fs-14 block">{t(`common:roles.${role}`)}</span>
              <span className="fs-12 block text-muted-foreground">
                {displayName}
              </span>
            </span>
            {role === current ? (
              <Check className="size-4" aria-label={t("common:demo.current")} />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
