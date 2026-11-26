import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { renderOrders } from "./orderTestKit";

// Everything but the panel's own namespace: it is the one under test.
beforeAll(async () => {
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
  ]);
});

describe("the words of the revision panel", () => {
  it("load with the New order page, not when the panel opens", async () => {
    // A namespace that loaded at the press would suspend the whole page behind
    // its skeleton, and the form's draft would be read again when it came back,
    // with a "Draft restored" line over what the person had just typed.
    expect(i18n.hasLoadedNamespace("directions-orders")).toBe(false);
    renderOrders("/orders/new");
    expect(
      await screen.findByRole("heading", { level: 1, name: "New order" }),
    ).toBeVisible();
    expect(i18n.hasLoadedNamespace("directions-orders")).toBe(true);
  });
});
