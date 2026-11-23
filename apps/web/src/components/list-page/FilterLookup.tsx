import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FilterOption } from "./types";

interface FilterLookupProps {
  label: string;
  allLabel: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string | undefined) => void;
  /** Draw the label above the field, as in the More filters popover. */
  showLabel?: boolean;
}

/**
 * A select with a search box, for a list too long to scan: customers, vendors,
 * items. The value is the Business Central number, never the name.
 */
export function FilterLookup({
  label,
  allLabel,
  value,
  options,
  onChange,
  showLabel = false,
}: FilterLookupProps) {
  const { t } = useTranslation("list-page");
  const id = useId();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  const pick = (next: string | undefined) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <div className="dt-field">
      <span id={id} className="dt-field-label">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby={id}
            className={`dt-control lp-lookup justify-between font-normal ${showLabel ? "lp-wide" : ""}`}
          >
            <span className="truncate">
              {current?.label ?? (value || allLabel)}
            </span>
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        {/* The popover is a dialog, and axe asks every dialog for a name. */}
        <PopoverContent align="start" className="w-72 p-0" aria-labelledby={id}>
          <Command>
            <CommandInput placeholder={t("filters.lookupSearch", { label })} />
            <CommandList>
              <CommandEmpty>{t("filters.lookupEmpty")}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  className="pointer-coarse:min-h-11"
                  value={allLabel}
                  onSelect={() => {
                    pick(undefined);
                  }}
                >
                  {allLabel}
                  {value === "" ? <Check className="ml-auto" /> : null}
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    className="pointer-coarse:min-h-11"
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      pick(option.value);
                    }}
                  >
                    {option.label}
                    {option.value === value ? (
                      <Check className="ml-auto" />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
