import { useFormContext, useWatch } from "react-hook-form";
import { MaskedValue } from "@/components/common";
import { lookupValueSchema } from "@/components/form";
import { cn } from "@/lib/utils";
import { useGrid } from "./gridContext";

// The mask's "why" button is small for a mouse; a finger needs 44 px.
export const TOUCH_BUTTONS =
  "[&_button]:pointer-coarse:size-11 @max-lines:[&_button]:size-11";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

interface ReadTextProps {
  field: "description" | "quantity" | "unitPrice";
  row: string;
  numeric?: boolean;
}

/** A value drawn as plain text, for a record that is only being read. */
export function ReadText({ field, row, numeric = false }: ReadTextProps) {
  const { control } = useFormContext();
  const value = asText(useWatch({ control, name: `${row}.${field}` }));
  return (
    <span
      className={cn(
        "block min-h-8 py-1.5 text-sm break-words",
        numeric && "tabular-nums @lines:text-right",
      )}
    >
      {value === "" ? <span className="text-muted-foreground">-</span> : value}
    </span>
  );
}

export function ReadItem({ row }: { row: string }) {
  const { control } = useFormContext();
  const parsed = lookupValueSchema.safeParse(
    useWatch({ control, name: `${row}.item` }),
  );
  if (!parsed.success) {
    return <span className="block py-1.5 text-muted-foreground">-</span>;
  }
  return (
    <span className="block py-1.5 text-sm break-words">
      <span className="font-mono text-xs">{parsed.data.number}</span>
      <span className="ml-2">{parsed.data.name}</span>
    </span>
  );
}

/** Where a price would be: the mask and why, never the value. */
export function MaskedPrice({ numeric = true }: { numeric?: boolean }) {
  const { priceMask } = useGrid();
  if (priceMask === null) return null;
  return (
    <span
      className={cn(
        "flex min-h-8 items-center py-1",
        numeric && "@lines:justify-end",
        TOUCH_BUTTONS,
      )}
    >
      <MaskedValue
        masked
        reason={priceMask.reason}
        visibleTo={priceMask.visibleTo}
      />
    </span>
  );
}
