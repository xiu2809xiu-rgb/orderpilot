import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { MenuEntry } from "@/features/define";
import { cn } from "@/lib/utils";
import { CountBadge } from "./CountBadge";
import { useWaiting } from "./MenuCount";
import { RailTip } from "./RailTip";

interface PanelEntryRowProps {
  entry: MenuEntry;
  current: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * One row of the panel: an icon, the page's name and the count of work that
 * waits behind it. It is always a link to a page the role may open. In the
 * 64 px rail the name moves into a tooltip and the count becomes a dot.
 */
export function PanelEntryRow({
  entry,
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

  return (
    <RailTip
      show={collapsed}
      tip={
        <>
          <span className="block font-medium">{label}</span>
          {waiting > 0 ? (
            <span className="numeral block">
              {t("nav.waiting", { count: waiting })}
            </span>
          ) : null}
        </>
      }
    >
      <Link
        ref={linkRef}
        to={entry.to}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
        className="dx-entry"
      >
        <entry.icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>
          {label}
        </span>
        {waiting > 0 ? (
          collapsed ? (
            <>
              <span className="sr-only">
                {t("nav.waiting", { count: waiting })}
              </span>
              {/* The rail has no room for a number: a dot says work waits, and
                  the tooltip and the screen reader carry the count. */}
              <span
                aria-hidden="true"
                className="absolute top-2 right-3 size-2 rounded-full bg-primary"
              />
            </>
          ) : (
            <CountBadge className="ml-auto" size="sm">
              {shown}
              <span className="sr-only"> {t("nav.waitingWord")}</span>
            </CountBadge>
          )
        ) : null}
      </Link>
    </RailTip>
  );
}
