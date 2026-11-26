import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AvailabilityControl } from "@/components/kit/availability-picker/AvailabilityControl";
import { UserAvatar } from "@/components/parts/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./overlays/dropdown-menu";
import { useAvailability } from "@/lib/useAvailability";
import { useMyPicture } from "@/lib/useMyPicture";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { useSignOut } from "./useSignOut";

/**
 * Who is signed in, at the foot of the side panel. The row opens the account
 * menu: settings and signing out. In the 64 px rail only the initials show.
 */
export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const user = useSessionStore((state) => state.session?.user);
  const { requestSignOut, dialog } = useSignOut();
  // Only the approved picture: one that waits for review is for its owner's
  // card and the reviewers, never the menu.
  const { picture } = useMyPicture();
  const availability = useAvailability();
  if (!user) return null;

  return (
    <>
      {/* The availability button is laid over the corner of the avatar. It is
          a sibling of the account menu's button, never inside it: a button in
          a button is invalid, and the inner one could not be reached. */}
      <div className="dx-person-row">
        <DropdownMenu>
          <DropdownMenuTrigger className="dx-entry dx-person">
            <UserAvatar
              name={user.displayName}
              pictureId={picture?.approved?.id}
              className="size-8"
              textClassName="fs-12"
            />
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
            <DropdownMenuItem onSelect={requestSignOut}>
              <LogOut aria-hidden="true" />
              {t("userMenu.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {availability.status === "ready" ? (
          <AvailabilityControl
            {...availability.controlProps}
            className="dx-person-dot"
            skin="dot"
            side={collapsed ? "right" : "top"}
            align={collapsed ? "end" : "start"}
          />
        ) : null}
      </div>
      {dialog}
    </>
  );
}
