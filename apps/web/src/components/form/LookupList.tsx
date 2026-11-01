import { LoaderCircle } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LookupOption } from "./lookup";
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

/** Keeps focus in the search box, where the keyboard works the list. */
function keepFocus(event: MouseEvent) {
  event.preventDefault();
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

/** The results under a lookup's search box, and what to say when there are none. */
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
    <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
      {options.length > 0 ? (
        // The pointer is handled once, on the list: the options are never
        // focused themselves, since the keyboard stays in the search box.
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-busy={status === "loading" ? true : undefined}
          className="max-h-60 overflow-y-auto py-1"
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
                "flex cursor-pointer items-baseline gap-2 px-2 py-1.5 text-sm",
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
    </div>
  );
}

function LookupFooter({
  status,
  query,
  count,
  onRetry,
}: {
  status: LookupState["status"];
  query: string;
  count: number;
  onRetry: () => void;
}) {
  const { t } = useTranslation("form");
  if (status === "loading") {
    return (
      <p className="flex items-center gap-1.5 border-t px-2 py-1.5 text-xs text-muted-foreground first:border-t-0">
        <LoaderCircle
          className="size-3 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t("lookup.searching")}
      </p>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
        <span className="text-destructive">{t("lookup.failed")}</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          tabIndex={-1}
          onMouseDown={keepFocus}
          onClick={onRetry}
          className="ml-auto"
        >
          {t("lookup.retry")}
        </Button>
      </div>
    );
  }
  if (status === "done" && count === 0) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        {query.trim() === ""
          ? t("lookup.typeToSearch")
          : t("lookup.noResults", { query: query.trim() })}
      </p>
    );
  }
  return null;
}
