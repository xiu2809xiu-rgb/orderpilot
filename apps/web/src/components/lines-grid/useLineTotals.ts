import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { readLines, totalsOf } from "./lineMath";
import type { LineTotals, PriceMask, ServerTotals } from "./types";

interface TotalsOptions {
  name?: string;
  hasAmount?: boolean;
  priceMask?: PriceMask | null;
  /** The totals the server worked out on its last answer. */
  serverTotals?: ServerTotals;
}

function sameFigures(a: LineTotals, b: LineTotals): boolean {
  return (
    a.lineCount === b.lineCount &&
    a.quantity === b.quantity &&
    a.amount === b.amount
  );
}

/**
 * The one value a footer needs: line count, quantity and total, worked out
 * from the decimal strings in the form as they change. The server computes the
 * same again when it saves and its answer wins: while `serverTotals` is there
 * and the lines have not changed since, those are the figures shown. A masked
 * price masks the total too, since a total would give the prices away.
 */
export function useLineTotals({
  name = "lines",
  hasAmount = true,
  priceMask = null,
  serverTotals,
}: TotalsOptions = {}): LineTotals {
  const { control } = useFormContext();
  const lines = readLines(useWatch({ control, name }));
  const local = totalsOf(lines, { hasAmount, masked: priceMask });
  // The figures the lines gave when the server's answer arrived. Adjusting
  // state while rendering is how React keeps a value tied to a prop.
  const [arrival, setArrival] = useState<{
    server: ServerTotals;
    local: LineTotals;
  } | null>(null);
  if (serverTotals !== arrival?.server) {
    setArrival(serverTotals ? { server: serverTotals, local } : null);
  }
  if (!serverTotals || !arrival || !sameFigures(arrival.local, local)) {
    return local;
  }
  return {
    ...local,
    quantity: serverTotals.quantity ?? local.quantity,
    amount:
      local.amount === null ? null : (serverTotals.amount ?? local.amount),
    fromServer: true,
  };
}
