import { useId, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { LookupOption } from "./lookup";
import { LookupFooter } from "./LookupFooter";
import type { LookupState } from "./useLookupSearch";

interface LookupListProps {
  listId: string;
  label: string;
  state: LookupState;
  active: number;
  onPick: (option: LookupOption) => void;
  onHover: (index: number) => void;
  onRetry: () => void;
}

/** The option under the pointer, or -1. */
function indexAt(event: MouseEvent): number {
  const target = event.target instanceof Element ? event.target : null;
  const index = target?.closest("[data-index]")?.getAttribute("data-index");
  return index === null || index === undefined ? -1 : Number(index);
}

export function optionId(listId: string, index: number): string {
  return `${listId}-option-${String(index)}`;
}

interface RowProps {
  listId: string;
  option: LookupOption;
  index: number;
  active: boolean;
}

function OptionRow({ listId, option, index, active }: RowProps) {
  const { t } = useTranslation("form");
  return (
    <div
      id={optionId(listId, index)}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      data-index={index}
      data-possible={option.possible === true ? "" : undefined}
      className={cn(
        "flex cursor-pointer items-baseline gap-2 px-2 py-1.5 text-sm pointer-coarse:py-3",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <span className="shrink-0 font-mono text-xs tabular-nums">
        {option.number}
      </span>
      <span className="min-w-0 truncate">{option.name}</span>
      {option.possible === true ? (
        <span className="sr-only">{t("lookup.possibleOption")}</span>
      ) : null}
      {option.detail === undefined ? null : (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {option.detail}
        </span>
      )}
    </div>
  );
}

/**
 * The results under a lookup's search box, and what to say when there are
 * none. It sits in a popover, which keeps it on screen in a short window.
 * Look-alike names come last, under a heading of their own, so that nobody
 * takes a guess for a match.
 */
export function LookupList({
  listId,
  label,
  state,
  active,
  onPick,
  onHover,
  onRetry,
}: LookupListProps) {
  const { t } = useTranslation("form");
  const headingId = useId();
  const { status, query, options } = state;
  const indexed = options.map((option, index) => ({ option, index }));
  const found = indexed.filter((entry) => entry.option.possible !== true);
  const possible = indexed.filter((entry) => entry.option.possible === true);
  const footer = (
    <LookupFooter
      status={status}
      query={query}
      count={found.length}
      onRetry={onRetry}
    />
  );
  const row = ({ option, index }: (typeof indexed)[number]) => (
    <OptionRow
      key={option.number}
      listId={listId}
      option={option}
      index={index}
      active={index === active}
    />
  );
  return (
    <>
      {/* Nothing matched the text itself: say so before the guesses. */}
      {found.length === 0 && possible.length > 0 ? footer : null}
      {options.length > 0 ? (
        // The pointer is handled once, on the list: the options are never
        // focused themselves, since the keyboard stays in the search box.
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-busy={status === "loading" ? true : undefined}
          className="max-h-[min(15rem,var(--radix-popover-content-available-height))] overflow-y-auto py-1"
          onMouseDown={(event) => {
            event.preventDefault();
            const option = options[indexAt(event)];
            if (option) onPick(option);
          }}
          onMouseMove={(event) => {
            const index = indexAt(event);
            if (index >= 0 && index !== active) onHover(index);
          }}
        >
          {found.map(row)}
          {possible.length > 0 ? (
            <div role="group" aria-labelledby={headingId}>
              <div
                id={headingId}
                className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground"
              >
                {t("lookup.possible")}
              </div>
              {possible.map(row)}
            </div>
          ) : null}
        </div>
      ) : null}
      {found.length === 0 && possible.length > 0 ? null : footer}
    </>
  );
}
