import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import type { MenuEntry } from "@/features/define";
import { isEntryActive } from "@/features/nav";
import { cn } from "@/lib/utils";
import { MenuCount, useWaiting } from "./MenuCount";

/** One line of the menu: icon, name, and the count of work waiting behind it. */
export function MenuLink({
  entry,
  onNavigate,
}: {
  entry: MenuEntry;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const active = isEntryActive(entry, { pathname, search });
  const waiting = useWaiting(entry.count);
  const label = t(entry.label);

  return (
    <Link
      to={entry.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <entry.icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">
        {label}
        {waiting > 0 ? " " : null}
      </span>
      {waiting > 0 ? <MenuCount waiting={waiting} /> : null}
    </Link>
  );
}
