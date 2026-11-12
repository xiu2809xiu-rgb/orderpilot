import {
  AS_OF,
  createSyntheticDataset,
  plantedCases,
} from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { renderDocument } from "./render.js";

const dataset = createSyntheticDataset({ referenceDate: AS_OF });

describe("the planted PI whose price differs from its PO", () => {
  const { order } = plantedCases(dataset).piPriceMismatch;
  const { scenario } = order;
  if (scenario.kind !== "pi-price-mismatch") throw new Error("not planted");

  const price = (
    fields: readonly { id: string; value: string }[],
    line: number,
  ): string | undefined =>
    fields.find((f) => f.id === `lines.unitPrice[${String(line)}]`)?.value;

  it("prints its own price on line 1 and the PO's price on the PO", async () => {
    const pi = await renderDocument(
      dataset,
      order.header.no,
      "PROFORMA_INVOICE",
    );
    const po = await renderDocument(dataset, order.header.no, "CUSTOMER_PO");
    expect(price(pi.fields, 0)).toBe(scenario.piPrice);
    expect(price(po.fields, 0)).toBe(scenario.poPrice);
    expect(scenario.piPrice).not.toBe(scenario.poPrice);
  });

  it("agrees with the PO on every other line", async () => {
    const pi = await renderDocument(
      dataset,
      order.header.no,
      "PROFORMA_INVOICE",
    );
    const po = await renderDocument(dataset, order.header.no, "CUSTOMER_PO");
    expect(order.lines.length).toBeGreaterThan(1);
    for (let line = 1; line < order.lines.length; line++) {
      expect(price(pi.fields, line), `line ${String(line + 1)}`).toBe(
        price(po.fields, line),
      );
    }
  });
});
