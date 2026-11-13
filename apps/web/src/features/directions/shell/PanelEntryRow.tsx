import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWaiting } from "@/app/shell/MenuCount";
import { cn } from "@/lib/utils";
import { screenPath, type Direction } from "../directions";
import { CountBadge } from "./CountBadge";
import type { PanelEntry } from "./menu";

interface PanelEntryRowProps {
  entry: PanelEntry;
  direction: Direction;
  current: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * One row of the panel. It is a link where the preview has the screen, and a
 * plain row (not a link, not hoverable) where it has not, with the reason in
 * its tooltip. In the 64 px rail the name moves into the tooltip.
 */
export function PanelEntryRow({
  entry,
  direction,
  current,
  collapsed,
  onNavigate,
}: PanelEntryRowProps) {
  const { t } = useTranslation();
  const label = t(entry.label);
  const linkRef = useRef<HTMLAnchorElement>(null);
  // On a short window the middle scrolls: keep the current entry in view.
  useEffect(() => {
    const el = linkRef.current;
    // jsdom has no scrollIntoView.
    if (current && el && "scrollIntoView" in el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [current]);
  const waiting = useWaiting(entry.count);
  const shown = waiting > 99 ? "99+" : waiting.toLocaleString("en");
  const countNode =
    waiting > 0 ? (
      collapsed ? (
        // The rail has no room for a number: a dot says work waits, and the
        // tooltip and the screen reader carry the count.
        <span
          aria-hidden="true"
          className="absolute top-2 right-3 size-2 rounded-full bg-primary"
        />
      ) : (
        <CountBadge className="ml-auto" size="sm">
          {shown}
          <span className="sr-only"> {t("nav.waitingWord")}</span>
        </CountBadge>
      )
    ) : null;
  const content = (
    <>
      <entry.icon className="size-[18px] shrink-0" aria-hidden="true" />
      <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>
        {label}
      </span>
      {collapsed && waiting > 0 ? (
        <span className="sr-only">{t("nav.waiting", { count: waiting })}</span>
      ) : null}
      {countNode}
    </>
  );
  const row = entry.screen ? (
    <Link
      ref={linkRef}
      to={screenPath(direction, entry.screen)}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className="dx-entry"
    >
      {content}
    </Link>
  ) : (
    <button type="button" aria-disabled="true" className="dx-entry">
      {content}
    </button>
  );
  if (!collapsed && entry.screen) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right" className="fs-13">
        {collapsed ? <span className="block font-medium">{label}</span> : null}
        {waiting > 0 ? (
          <span className="numeral block">
            {t("nav.waiting", { count: waiting })}
          </span>
        ) : null}
        {entry.screen ? null : (
          <span className="block">{t("directions:panel.layoutOnly")}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
