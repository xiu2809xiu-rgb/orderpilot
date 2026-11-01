import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { RefCallback } from "react";
import { useTranslation } from "react-i18next";
import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FIELD_CONTROL } from "./fieldTypes";
import {
  lookupText,
  type LookupOption,
  type LookupSearch,
  type LookupValue,
} from "./lookup";
import { LookupList, optionId } from "./LookupList";
import { useLookupSearch, type LookupState } from "./useLookupSearch";

export interface LookupControlProps {
  value: LookupValue | null;
  onChange: (value: LookupValue | null) => void;
  onBlur: () => void;
  inputRef: RefCallback<HTMLInputElement>;
  name: string;
  label: string;
  search: LookupSearch;
  debounceMs: number;
  placeholder: string | undefined;
  required: boolean | undefined;
  disabled: boolean | undefined;
}

function announcementKey(state: LookupState) {
  if (state.status === "loading") return "lookup.searching";
  if (state.status === "failed") return "lookup.failed";
  return state.status === "done" ? "lookup.results" : null;
}

/**
 * The search box of a lookup, on the ARIA combobox pattern. Typing searches;
 * the arrows move through the results; Enter picks one; Escape closes the list,
 * then puts back what was there before. Leaving with typed text and no pick
 * keeps the text and leaves the field empty, so its error says what is missing.
 */
export function LookupControl({
  value,
  onChange,
  onBlur,
  inputRef,
  name,
  label,
  search,
  debounceMs,
  placeholder,
  required,
  disabled,
}: LookupControlProps) {
  const { t } = useTranslation("form");
  const listId = useId();
  const statusId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const before = useRef(value);
  const ownChange = useRef(false);
  const { state, run, schedule, stop } = useLookupSearch(search, debounceMs);
  const options = state.options;
  const current = active < options.length ? active : -1;

  const shown = lookupText(value);
  const said = announcementKey(state);

  // A reset or a restored draft replaces the value: show it, not old typing.
  // Keyed on the text, since the value is a fresh object on every render.
  useEffect(() => {
    if (ownChange.current) {
      ownChange.current = false;
      return;
    }
    setQuery(null);
  }, [shown]);

  function change(next: LookupValue | null) {
    if (lookupText(next) === shown) return;
    ownChange.current = true;
    onChange(next);
  }

  function openList(text: string) {
    setOpen(true);
    setActive(-1);
    run(text);
  }

  function pick(option: LookupOption) {
    change({ number: option.number, name: option.name });
    setQuery(null);
    setOpen(false);
    stop();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const text = query ?? "";
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open || state.status === "failed") {
        openList(text);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(Math.min(Math.max(current + step, 0), options.length - 1));
    } else if (event.key === "Enter") {
      // Enter belongs to the list here, never to the form.
      event.preventDefault();
      const option = open ? options[current] : undefined;
      if (option) pick(option);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        stop();
      } else if (query !== null) {
        event.preventDefault();
        setQuery(null);
        change(before.current);
      }
    }
  }

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <FormControl describedBy={statusId}>
        <Input
          ref={inputRef}
          name={name}
          role="combobox"
          aria-expanded={open}
          aria-controls={open && options.length > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && current >= 0 ? optionId(listId, current) : undefined
          }
          aria-required={required === true ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder ?? t("lookup.placeholder")}
          value={query ?? shown}
          className={cn(FIELD_CONTROL, "pl-8")}
          onChange={(event) => {
            const text = event.target.value;
            if (query === null) before.current = value;
            setQuery(text);
            setOpen(true);
            setActive(-1);
            change(null);
            schedule(text);
          }}
          onClick={() => {
            if (!open) openList(query ?? "");
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
            stop();
            if (query?.trim() === "") setQuery(null);
            onBlur();
          }}
        />
      </FormControl>
      <span id={statusId} role="status" className="sr-only">
        {open && said !== null ? t(said, { count: state.options.length }) : ""}
      </span>
      {open ? (
        <LookupList
          listId={listId}
          label={label}
          state={state}
          active={current}
          onPick={pick}
          onHover={setActive}
          onRetry={() => {
            run(query ?? "");
          }}
        />
      ) : null}
    </div>
  );
}
