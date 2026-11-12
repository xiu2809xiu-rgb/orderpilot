import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import type { DemoFile } from "../demo.js";
import { asEntry, type PlanEntry } from "./entry.js";

/**
 * The twelve demo files as plan entries. The one case the data plants among
 * them is the packing list that packs fewer than its PO orders, found by the
 * order's scenario, with the PO beside it as the source of the right quantity
 * and the packing list that agrees as its twin.
 */
export function twelvePlan(
  dataset: SyntheticDataset,
  files: readonly DemoFile[],
): PlanEntry[] {
  const scenarioOf = (orderNo: string) =>
    dataset.orders.find((o) => o.header.no === orderNo)?.scenario.kind;
  const isMismatch = (f: DemoFile): boolean =>
    f.kind === "PACKING_LIST" &&
    scenarioOf(f.orderNo) === "packing-list-mismatch";
  return files.map((file) => {
    if (!isMismatch(file)) return asEntry(file);
    const po = files.find(
      (f) => f.kind === "CUSTOMER_PO" && f.orderNo === file.orderNo,
    );
    const twin = files.find((f) => f.kind === "PACKING_LIST" && !isMismatch(f));
    if (!po) throw new Error(`The data has no PO for ${file.stem}`);
    return asEntry(file, {
      planted: "quantity",
      expectedFrom: {
        "lines.quantity[0]": {
          source: "document",
          stem: po.stem,
          fieldId: "lines.quantity[0]",
        },
      },
      twin: twin?.stem ?? null,
    });
  });
}
