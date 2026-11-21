import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  lookupText,
  type LookupOption,
  type LookupSearch,
  type LookupValue,
} from "./lookup";
import { optionId } from "./LookupList";
import { resolveTyped } from "./lookupResolve";
import { useLookupSearch } from "./useLookupSearch";

export interface LookupBehaviour {
  value: LookupValue | null;
  onChange: (value: LookupValue | null) => void;
  onBlur: () => void;
  name: string;
  search: LookupSearch;
  debounceMs: number;
  touched: boolean;
  onPick: ((option: LookupOption) => void) | undefined;
}

/**
 * What a lookup does, apart from how it looks: the typed text, the open list,
 * the highlighted row and the keys that work them. The results shown are always
 * those of the text as it stands, so a key can never pick from older ones.
 */
export function useLookupCombobox({
  value,
  onChange,
  onBlur,
  name,
  search,
  debounceMs,
  touched,
  onPick,
}: LookupBehaviour) {
  const { t } = useTranslation("form");
  const { setError, getFieldState, trigger } = useFormContext();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const before = useRef(value);
  const ownChange = useRef(false);
  // Enter or Tab came before the search answered: pick when it does.
  const waiting = useRef(false);
  // The down arrow came before the search answered: highlight the first row
  // when it does. The key is not lost, and nothing is picked unseen.
  const armed = useRef(false);
  const { state, run, schedule, stop } = useLookupSearch(search, debounceMs);
  const options = state.options;
  const current = active < options.length ? active : -1;
  const listed = open && options.length > 0;
  const shown = lookupText(value);

  // A reset or a restored draft replaces the value: show it, not old typing.
  // Keyed on the text, since the value is a fresh object on every render.
  useEffect(() => {
    if (ownChange.current) {
      ownChange.current = false;
      return;
    }
    setQuery(null);
  }, [shown]);

  // A reset also turns "touched" off, which is the one sign of it when the
  // field was empty before and after, with only typing to throw away.
  useEffect(() => {
    if (!touched) setQuery(null);
  }, [touched]);

  useEffect(() => {
    if (listed && current >= 0) {
      document
        .getElementById(optionId(listId, current))
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [listed, current, listId]);

  function change(next: LookupValue | null) {
    if (lookupText(next) === shown) return;
    ownChange.current = true;
    onChange(next);
  }

  function pick(option: LookupOption) {
    waiting.current = false;
    change({ number: option.number, name: option.name });
    setQuery(null);
    setOpen(false);
    stop();
    onPick?.(option);
  }

  /** Text that names no record: say so, unless the schema already has. */
  function flagUnmatched() {
    // After the field's own validation, which would otherwise clear this.
    setTimeout(() => {
      if (getFieldState(name).error === undefined) {
        setError(name, { type: "lookup", message: t("lookup.notChosen") });
      }
    }, 0);
  }

  // The latest of these for the effect below, which must not restart each render.
  const latest = useRef({ pick, flagUnmatched });
  useEffect(() => {
    latest.current = { pick, flagUnmatched };
  });

  useEffect(() => {
    if (state.status === "loading") return;
    const wasArmed = armed.current;
    armed.current = false;
    const showFirst = wasArmed && state.options.length > 0;
    if (waiting.current) {
      waiting.current = false;
      const hit = resolveTyped(state, query ?? "");
      if (hit) {
        latest.current.pick(hit);
        return;
      }
      // A person who pressed the down arrow asked for the list, not for a verdict
      // on the typed text: show them the first row to press Enter on.
      if (!showFirst && query?.trim()) {
        latest.current.flagUnmatched();
        return;
      }
    }
    if (showFirst) setActive(0);
  }, [state, query]);

  function openList(text: string, byArrow = false) {
    armed.current = byArrow;
    setOpen(true);
    setActive(-1);
    run(text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const text = query ?? "";
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open || state.status === "failed") {
        openList(text, event.key === "ArrowDown");
        return;
      }
      if (options.length === 0) {
        // The answer is on its way: remember the key rather than lose it.
        armed.current = event.key === "ArrowDown" && state.status === "loading";
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(Math.min(Math.max(current + step, 0), options.length - 1));
    } else if (event.key === "Enter") {
      // Enter belongs to the list here, never to the form.
      event.preventDefault();
      const hit =
        open && options[current] ? options[current] : resolveTyped(state, text);
      if (hit) pick(hit);
      else if (text.trim() !== "" && state.status === "loading") {
        waiting.current = true;
      } else if (text.trim() !== "" && state.status === "done") {
        // Nothing is chosen, so say so now, in the field's own words, as leaving
        // the field would: the form's rule runs first, and the generic line is
        // only the fallback for a form whose rule says nothing about it.
        void trigger(name).then(flagUnmatched);
      }
    } else if (event.key === "Escape") {
      armed.current = false;
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

  function onType(text: string) {
    if (query === null) before.current = value;
    waiting.current = false;
    armed.current = false;
    setQuery(text);
    setOpen(true);
    setActive(-1);
    change(null);
    schedule(text);
  }

  function onLeave() {
    armed.current = false;
    setOpen(false);
    const typed = query?.trim() ?? "";
    if (typed === "") {
      if (query !== null) setQuery(null);
      stop();
    } else {
      const hit = resolveTyped(state, typed);
      if (hit) pick(hit);
      else if (state.status === "loading") waiting.current = true;
      else {
        stop();
        flagUnmatched();
      }
    }
    onBlur();
  }

  return {
    listId,
    state,
    listed,
    open,
    current,
    text: query ?? shown,
    onType,
    onKeyDown,
    onLeave,
    onClick: () => {
      if (!open) openList(query ?? "");
    },
    pick,
    hover: setActive,
    retry: () => {
      run(query ?? "");
    },
  };
}
