import { useCallback, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { normaliseDecimal, type LookupOption } from "@/components/form";
import { focusPlace } from "./gridNav";
import { itemOptionSchema, type PriceMask } from "./types";

interface PickOptions {
  name: string;
  priceMask: PriceMask | null;
  itemPrice: "fill" | "reference";
  /** Where the focus goes after an item picked by Enter, such as the quantity. */
  advanceTo: string | undefined;
  /** The line that asked to move on once its item is picked, if any. */
  advance: { current: number | null };
  root: { current: HTMLElement | null };
}

/**
 * What picking an item fills in on its line: the description, the unit, the
 * stock the API reported and, if the role may see prices, the default price (or,
 * for a screen where a document sets the price, the list price as context only).
 * A masked price is never written, so it cannot reach a draft.
 */
export function useItemPick({
  name,
  priceMask,
  itemPrice,
  advance,
  advanceTo,
  root,
}: PickOptions) {
  const { setValue } = useFormContext();
  const latest = useRef({ name, priceMask, advanceTo, itemPrice });
  useEffect(() => {
    latest.current = { name, priceMask, advanceTo, itemPrice };
  });

  return useCallback(
    (index: number, option: LookupOption) => {
      const { name, priceMask, advanceTo, itemPrice } = latest.current;
      const parsed = itemOptionSchema.safeParse(option);
      const item = parsed.success
        ? parsed.data
        : { number: option.number, name: option.name };
      const set = (field: string, value: string | null) => {
        setValue(`${name}.${String(index)}.${field}`, value, {
          shouldDirty: true,
        });
      };
      set(
        "description",
        "description" in item && item.description
          ? item.description
          : item.name,
      );
      set("unit", "unit" in item ? (item.unit ?? "") : "");
      set(
        "availableStock",
        "availableStock" in item ? (item.availableStock ?? null) : null,
      );
      if (priceMask === null) {
        const price = "unitPrice" in item ? item.unitPrice : undefined;
        const usable = price && !price.masked && price.value !== null;
        const text = usable ? normaliseDecimal(price.value ?? "", 2) : "";
        if (itemPrice === "fill") set("unitPrice", text);
        else set("listPrice", text === "" ? null : text);
      }
      if (advance.current === index) {
        advance.current = null;
        // After the lookup has finished with the keystroke that picked.
        setTimeout(() => {
          const element = root.current;
          if (element && advanceTo) focusPlace(element, index, advanceTo);
        }, 0);
      }
    },
    [setValue, advance, root],
  );
}
