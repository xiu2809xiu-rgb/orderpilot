import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import type { Kpi } from "@orderpilot/shared";
import i18n from "@/i18n";
import { must } from "@/test/must";
import { KpiTiles } from "./KpiTiles";

// The comparison is the point of a tile, so each figure keeps its label and its
// place. Only the weight differs: the answer leads, the baseline is quiet, and
// the draft wording is the faintest.

const measure: Kpi = {
  id: "processingTime",
  label: "Order-processing time",
  unit: "minutes per order",
  manual: 40,
  withOrderPilot: 10,
  lowerIsBetter: true,
  definition: "From the PO arriving to the PI being sent.",
};

beforeAll(async () => {
  await i18n.loadNamespaces(["insights"]);
});

describe("an Insights tile", () => {
  it("makes the With OrderPilot figure the heaviest mark and By hand the quiet baseline", () => {
    render(<KpiTiles measures={[measure]} />);
    const manual = screen.getByText("40").closest("dd");
    const withOrderPilot = screen.getByText("10").closest("dd");
    expect(manual).toHaveClass("font-normal", "text-muted-foreground");
    expect(manual).not.toHaveClass("numeral");
    expect(withOrderPilot).toHaveClass("numeral");
    // Same size: only weight and colour tell them apart.
    expect(manual).toHaveClass("fs-28");
    expect(withOrderPilot).toHaveClass("fs-28");
  });

  it("draws the draft definition in the faint tier", () => {
    render(<KpiTiles measures={[measure]} />);
    const definition = must(
      screen
        .getByText("From the PO arriving to the PI being sent.", {
          exact: false,
        })
        .closest("p"),
    );
    expect(definition).toHaveClass("text-faint-foreground");
    expect(within(definition).getByText(/Draft definition/)).toBeVisible();
  });
});
