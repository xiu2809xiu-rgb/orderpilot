import type { MouseEvent } from "react";
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

/**
 * The results under a lookup's search box, and what to say when there are
 * none. It sits in a popover, which keeps it on screen in a short window.
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
  const { status, query, options } = state;
  return (
    <>
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
          {options.map((option, index) => (
            <div
              key={option.number}
              id={optionId(listId, index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              data-index={index}
              className={cn(
                "flex cursor-pointer items-baseline gap-2 px-2 py-1.5 text-sm pointer-coarse:py-3",
                index === active && "bg-accent text-accent-foreground",
              )}
            >
              <span className="shrink-0 font-mono text-xs tabular-nums">
                {option.number}
              </span>
              <span className="min-w-0 truncate">{option.name}</span>
              {option.detail === undefined ? null : (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {option.detail}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <LookupFooter
        status={status}
        query={query}
        count={options.length}
        onRetry={onRetry}
      />
    </>
  );
}
