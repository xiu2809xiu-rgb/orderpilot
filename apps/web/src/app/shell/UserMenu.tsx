import { LogOut, Settings } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/api/auth";
import { anyFormDirty } from "@/lib/dirty-forms";
import { useSessionStore } from "@/stores/session";
// Only needed when someone signs out over unsaved changes.
const SignOutDialog = lazy(() =>
  import("./SignOutDialog").then((m) => ({ default: m.SignOutDialog })),
);

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.session?.user);
  const [asking, setAsking] = useState(false);
  // Loaded on the first ask, then kept so that closing can return focus.
  const [askedOnce, setAskedOnce] = useState(false);
  if (!user) return null;

  function signOut() {
    setAsking(false);
    void logout().then(() => navigate("/login"));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            // The initials are the visible text, so the name carries them too
            // (WCAG 2.5.3, label in name).
            aria-label={t("userMenu.label", {
              initials: initials(user.displayName),
            })}
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block text-xs text-muted-foreground">
              {t("userMenu.signedInAs")}
            </span>
            <span className="block text-sm font-medium">
              {user.displayName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(`roles.${user.role}`)}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings aria-hidden="true" />
              {t("nav.settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              // Signing out deletes the drafts here, so changes get asked about.
              if (anyFormDirty()) {
                setAskedOnce(true);
                setAsking(true);
              } else signOut();
            }}
          >
            <LogOut aria-hidden="true" />
            {t("userMenu.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {askedOnce ? (
        <Suspense fallback={null}>
          <SignOutDialog
            open={asking}
            onKeep={() => {
              setAsking(false);
            }}
            onSignOut={signOut}
          />
        </Suspense>
      ) : null}
    </>
  );
}
