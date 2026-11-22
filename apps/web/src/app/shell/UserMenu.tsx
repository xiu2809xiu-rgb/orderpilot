import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./overlays/dropdown-menu";
import { logout } from "@/lib/api/auth";
import { anyFormDirty } from "@/lib/dirty-forms";
import { cn } from "@/lib/utils";
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

/**
 * Who is signed in, at the foot of the side panel. The row opens the account
 * menu: settings and signing out. In the 64 px rail only the initials show.
 */
export function UserMenu({ collapsed }: { collapsed: boolean }) {
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
        <DropdownMenuTrigger className="dx-entry dx-person">
          <Avatar className="size-8 shrink-0" aria-hidden="true">
            <AvatarFallback className="fs-12 bg-accent font-semibold text-accent-foreground">
              {initials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          {/* The name and the role are the visible text, so they are part of
              the button's name too (WCAG 2.5.3, label in name). */}
          <span className={cn("min-w-0 flex-1", collapsed && "sr-only")}>
            <span className="sr-only">{t("userMenu.label")}</span>
            <span className="fs-14 block truncate font-medium text-foreground">
              {user.displayName}
            </span>
            <span className="fs-12 block truncate text-muted-foreground">
              {t(`roles.${user.role}`)}
            </span>
          </span>
          <ChevronsUpDown
            className={cn(
              // -me-1: the icon's own empty box is 4.7 px wide on its right,
              // so its ink ended 16.7 px from the edge against the avatar's
              // 12 px on the left.
              "-me-1 size-4 shrink-0 text-muted-foreground",
              collapsed && "hidden",
            )}
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          className="w-60"
        >
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
