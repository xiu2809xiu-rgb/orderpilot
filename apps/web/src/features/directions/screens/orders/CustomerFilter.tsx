import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FilterField } from "./FilterField";
import type { OrderRow } from "./orderRow";

export interface CustomerOption {
  no: string;
  name: string;
}

/** The customers that appear in the orders, by Business Central number: the name is shown, never matched. */
export function customersOf(rows: readonly OrderRow[]): CustomerOption[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!seen.has(row.customerNo)) {
      seen.set(row.customerNo, row.customerName ?? row.customerNo);
    }
  }
  return [...seen]
    .map(([no, name]) => ({ no, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * Many customers, so a search-as-you-type list rather than a select. The
 * number is what is chosen and what goes in the address.
 */
export function CustomerFilter({
  options,
  value,
  onChange,
}: {
  options: readonly CustomerOption[];
  value: string | null;
  onChange: (customer: string | null) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const id = useId();
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.no === value);
  const label = useMemo(
    () => (chosen ? chosen.name : t("filters.allCustomers")),
    [chosen, t],
  );
  return (
    <FilterField label={t("filters.customer")} htmlFor={id}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="od-control w-52 justify-between font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown aria-hidden="true" className="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={t("filters.customerSearch")} />
            <CommandList>
              <CommandEmpty>{t("filters.customerNone")}</CommandEmpty>
              <CommandItem
                value={t("filters.allCustomers")}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {t("filters.allCustomers")}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.no}
                  value={`${option.no} ${option.name}`}
                  onSelect={() => {
                    onChange(option.no);
                    setOpen(false);
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "size-4",
                      option.no === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.name}</span>
                  <span className="numeral ml-auto text-muted-foreground">
                    {option.no}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
