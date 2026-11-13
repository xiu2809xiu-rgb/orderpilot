import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session";
import { PanelAction } from "./PanelAction";
import { PanelHelp } from "./PanelHelp";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * The bottom of the panel: settings, help, and who is signed in. Spark lives
 * in the top bar only. It never scrolls and never moves; only the middle of
 * the panel gives way.
 */
export function PanelFoot({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation(["directions", "common"]);
  const user = useSessionStore((state) => state.session?.user);
  const role = user ? t(`common:roles.${user.role}`) : "";
  const person = user ? (
    <div
      className={cn(
        "dx-foot-person flex items-center gap-3 pt-2",
        collapsed && "justify-center px-0",
      )}
    >
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="fs-12 bg-accent font-semibold text-accent-foreground">
          {initials(user.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className={cn("min-w-0", collapsed && "sr-only")}>
        <p className="fs-14 truncate font-medium text-foreground">
          {user.displayName}
        </p>
        <p className="fs-12 truncate text-muted-foreground">{role}</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="dx-foot shrink-0 border-t border-sidebar-border pt-2 pb-3">
      <ul className="flex flex-col gap-0.5">
        <li>
          <PanelAction
            icon={Settings}
            label={t("panel.settings")}
            collapsed={collapsed}
            unavailable={t("panel.layoutOnly")}
          />
        </li>
        <li>
          <PanelHelp collapsed={collapsed} />
        </li>
      </ul>
      {person && user ? (
        collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>{person}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="fs-13">
              {t("panel.person", { name: user.displayName, role })}
            </TooltipContent>
          </Tooltip>
        ) : (
          person
        )
      ) : null}
    </div>
  );
}
