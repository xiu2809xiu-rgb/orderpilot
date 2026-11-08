import { useEffect } from "react";
import { useFormState, useWatch } from "react-hook-form";
import { useMasterDataAvailableStock } from "@/lib/api/generated/endpoints/master-data/master-data";
import type { OrderForm } from "./orderFormValues";

/** Mock Navision's figures move slowly, so a half minute is live enough. */
const REFRESH_MS = 30_000;

/**
 * Keeps the stock beside each line current. It draws nothing and sits beside
 * the grid, so a poll re-renders only this leaf and never the lines being
 * typed in. The figure is the server's, from the same formula as master data.
 *
 * It writes only what changed, and without marking the form changed: a poll
 * is not the person's edit. While a save is in flight it writes nothing, or
 * the saved form would look edited, and Void would ask to save first.
 */
export function LineAvailability({
  form,
  paused,
}: {
  form: OrderForm;
  /** A void order needs no stock. */
  paused: boolean;
}) {
  const lines = useWatch({ control: form.control, name: "lines" });
  const { isSubmitting } = useFormState({ control: form.control });
  const itemNos = [
    ...new Set(lines.flatMap((line) => (line.item ? [line.item.number] : []))),
  ]
    .sort()
    .join(",");
  const stock = useMasterDataAvailableStock(
    { itemNos },
    {
      query: {
        enabled: itemNos !== "" && !paused,
        refetchInterval: REFRESH_MS,
      },
    },
  );
  const answer = stock.data;

  useEffect(() => {
    if (!answer || isSubmitting) return;
    const byItem = new Map(answer.data.map((entry) => [entry.itemNo, entry]));
    form.getValues("lines").forEach((line, index) => {
      const found = line.item ? byItem.get(line.item.number) : undefined;
      if (!found) return;
      const at = `lines.${String(index)}` as `lines.${number}`;
      if (line.availableStock !== found.availableStock) {
        form.setValue(`${at}.availableStock`, found.availableStock, {
          shouldDirty: false,
        });
      }
      if (line.unit === "") {
        form.setValue(`${at}.unit`, found.unit, { shouldDirty: false });
      }
    });
  }, [answer, isSubmitting, form]);

  return null;
}
