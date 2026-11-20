import { useCallback, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { normaliseDecimal, type LookupOption } from "@/components/form";
import { focusPlace } from "./gridNav";
import { listPrice, priceForPick } from "./priceFill";
import { itemOptionSchema, type ItemPriceMode, type PriceMask } from "./types";

interface PickOptions {
  name: string;
  priceMask: PriceMask | null;
  itemPrice: ItemPriceMode;
  /** Where the focus goes after an item picked by Enter, such as the quantity. */
  advanceTo: string | undefined;
  /** The line that asked to move on once its item is picked, if any. */
  advance: { current: number | null };
  root: { current: HTMLElement | null };
}

/**
 * What picking an item fills in on its line: the description, the unit, the
 * stock the API reported and, if the role may see prices, the default price (or,
 * for a screen where a document sets the price, only a cleared last agreed price).
 * In "agreed" mode the price starts at the list price unless the person has
 * typed one for this item, and the screen swaps in the customer's agreed
 * price. A masked price is never written, so it cannot reach a draft.
 */
export function useItemPick({
  name,
  priceMask,
  itemPrice,
  advance,
  advanceTo,
  root,
}: PickOptions) {
  const { setValue, getValues } = useFormContext();
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
      const set = (field: string, value: unknown) => {
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
        if (itemPrice === "fill") {
          const price = "unitPrice" in item ? item.unitPrice : undefined;
          const usable = price && !price.masked && price.value !== null;
          set(
            "unitPrice",
            usable ? normaliseDecimal(price.value ?? "", 2) : "",
          );
        } else {
          // The last agreed price belongs to the old item, and the screen
          // writes the new one when its answer arrives.
          set("lastPrice", null);
          if (itemPrice === "agreed") {
            const fill = priceForPick(
              getValues(`${name}.${String(index)}`) as Parameters<
                typeof priceForPick
              >[0],
              item.number,
              listPrice("unitPrice" in item ? item.unitPrice : undefined),
            );
            set("unitPrice", fill.unitPrice);
            set("priceFrom", fill.priceFrom);
          }
        }
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
    [setValue, getValues, advance, root],
  );
}
