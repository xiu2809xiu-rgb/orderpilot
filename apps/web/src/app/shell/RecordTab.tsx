import { X } from "lucide-react";
import type { KeyboardEvent, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { RecordTab as Tab } from "@/stores/recordTabs";
import { RECORD_KIND_ICONS } from "./recordKindIcons";

export const RECORD_TABS_HINT_ID = "record-tabs-hint";

interface RecordTabProps {
  tab: Tab;
  active: boolean;
  /** The one tab the Tab key reaches; the arrow keys move between the rest. */
  focusable: boolean;
  linkRef: Ref<HTMLAnchorElement>;
  onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => void;
  onFocus: () => void;
  onClose: () => void;
}

/** One open record: a link to it, and its own close button. */
export function RecordTab({
  tab,
  active,
  focusable,
  linkRef,
  onKeyDown,
  onFocus,
  onClose,
}: RecordTabProps) {
  const { t } = useTranslation("record-tabs");
  const Icon = RECORD_KIND_ICONS[tab.kind];
  const name = t("name", {
    kind: t(`kinds.${tab.kind}`),
    no: tab.no,
  });

  return (
    <div
      className={cn(
        "relative flex h-8 items-center rounded-md border text-xs pointer-coarse:h-11",
        active
          ? "border-border bg-muted text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Link
        ref={linkRef}
        to={tab.to}
        title={name}
        tabIndex={focusable ? 0 : -1}
        aria-current={active ? "page" : undefined}
        aria-describedby={RECORD_TABS_HINT_ID}
        aria-keyshortcuts="Delete"
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onAuxClick={(event) => {
          // A middle click closes a tab, as it does in a browser.
          if (event.button !== 1) return;
          event.preventDefault();
          onClose();
        }}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        className="flex h-full items-center gap-1.5 rounded-md pr-1 pl-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t(`kinds.${tab.kind}`)} </span>
        <span
          className={cn(
            "font-mono whitespace-nowrap tabular-nums",
            active && "font-medium",
          )}
        >
          {tab.no}
        </span>
        {tab.dirty ? (
          <>
            <span
              className="size-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="sr-only">, {t("unsaved")}</span>
          </>
        ) : null}
      </Link>
      {/* Out of the Tab order: Delete on the tab does the same from the keyboard. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("close", { name })}
        onClick={onClose}
        className="mr-0.5 grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground pointer-coarse:size-11"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
