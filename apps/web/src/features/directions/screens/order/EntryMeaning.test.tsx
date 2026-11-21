import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { loadNamespaces } from "../orders/ordersTestKit";
import { EntryMeaning } from "./EntryMeaning";

beforeAll(loadNamespaces);

describe("what became of an order entered here", () => {
  it("says on the page why a reader finds no form on a draft", () => {
    render(<EntryMeaning state="draft" />);
    expect(
      screen.getByText(
        "Entered here as a draft. Only a role that may edit orders can change it.",
      ),
    ).toBeVisible();
  });

  it("says that a voided order cannot be changed", () => {
    render(<EntryMeaning state="void" />);
    expect(
      screen.getByText("Entered here and voided. It cannot be changed."),
    ).toBeVisible();
  });

  it("says that a submitted order is no longer a draft", () => {
    render(<EntryMeaning state="submitted" />);
    expect(
      screen.getByText(
        "Entered here and submitted. Only a draft can be changed.",
      ),
    ).toBeVisible();
  });
});
