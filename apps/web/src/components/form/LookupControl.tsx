import { Search } from "lucide-react";
import { useId } from "react";
import type { RefCallback } from "react";
import { useTranslation } from "react-i18next";
import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FIELD_CONTROL } from "./fieldTypes";
import type { LookupOption, LookupSearch, LookupValue } from "./lookup";
import { LookupList, optionId } from "./LookupList";
import { useLookupCombobox } from "./useLookupCombobox";
import type { LookupState } from "./useLookupSearch";

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
  /** True once the person has left the field; a form reset turns it off again. */
  touched: boolean;
  /** Called with the whole record that was picked, such as to fill a price. */
  onPick: ((option: LookupOption) => void) | undefined;
}

function announcementKey(state: LookupState) {
  if (state.status === "loading") return "lookup.searching";
  if (state.status === "failed") return "lookup.failed";
  return state.status === "done" ? "lookup.results" : null;
}

/**
 * The search box of a lookup, on the ARIA combobox pattern. Typing searches;
 * the arrows move through the results of what is typed now; Enter or Tab picks
 * the record the text names, or the highlighted one; Escape closes the list,
 * then puts back what was there before. Leaving with text that names no record
 * leaves the field empty and says so. The list is a popover, so that a grid
 * cell or a short window can neither clip it nor push it off screen.
 */
export function LookupControl({
  inputRef,
  label,
  placeholder,
  required,
  disabled,
  ...behaviour
}: LookupControlProps) {
  const { t } = useTranslation("form");
  const statusId = useId();
  const combobox = useLookupCombobox(behaviour);
  const { listId, state, listed, current } = combobox;
  const said = announcementKey(state);

  return (
    <Popover open={combobox.open}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground pointer-coarse:top-3.5"
            aria-hidden="true"
          />
          <FormControl describedBy={statusId}>
            <Input
              ref={inputRef}
              name={behaviour.name}
              role="combobox"
              aria-expanded={listed}
              aria-controls={listed ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                listed && current >= 0 ? optionId(listId, current) : undefined
              }
              aria-required={required === true ? true : undefined}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              placeholder={placeholder ?? t("lookup.placeholder")}
              value={combobox.text}
              className={cn(FIELD_CONTROL, "pl-8")}
              onChange={(event) => {
                combobox.onType(event.target.value);
              }}
              onClick={combobox.onClick}
              onKeyDown={combobox.onKeyDown}
              onBlur={combobox.onLeave}
            />
          </FormControl>
          <span id={statusId} role="status" className="sr-only">
            {combobox.open && said !== null
              ? t(said, { count: state.options.length })
              : ""}
          </span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        // The popover is a dialog to a screen reader, and a dialog needs a name.
        aria-label={label}
        className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <LookupList
          listId={listId}
          label={label}
          state={state}
          active={current}
          onPick={combobox.pick}
          onHover={combobox.hover}
          onRetry={combobox.retry}
        />
      </PopoverContent>
    </Popover>
  );
}
