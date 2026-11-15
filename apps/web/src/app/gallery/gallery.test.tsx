import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the component gallery route", () => {
  // Axe walks the whole page, forms included. Under a full parallel run that
  // takes longer than the usual limit, so this test has its own. It is also the
  // first to load the gallery's chunk, which now holds the lines grid too, so
  // the first lookup waits longer than the others do.
  it("shows every component to a demo session", async () => {
    const { container } = renderApp("/gallery", {
      session: sessionFor("AUDITOR"),
    });
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Component gallery" },
        { timeout: 20_000 },
      ),
    ).toBeVisible();
    expect(screen.getAllByText("Synthetic demo data").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Mock AI")).toBeVisible();
    expect(screen.getByText("Requires approval")).toBeVisible();
    // The gallery list has a record log of its own, so two headings start with the name.
    expect(
      screen.getAllByRole("heading", { name: /^Operation log/ }).length,
    ).toBe(2);
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);

  it("shows the document form with the actions this role may use", async () => {
    renderApp("/gallery", { session: sessionFor("AUDITOR") });
    const title = await screen.findByRole("heading", {
      level: 2,
      name: "Sales order SO-20261106-0001",
    });
    expect(title).toBeVisible();
    const form = screen.getByRole("form", { name: "Sales order" });
    expect(within(form).getByRole("button", { name: "Save" })).toBeVisible();
    expect(
      within(form).getByRole("button", { name: "Submit for approval" }),
    ).toBeVisible();
    // The auditor may read orders but not decide: Approve is not drawn at all.
    expect(within(form).queryByRole("button", { name: "Approve" })).toBeNull();
    // The status is in the head, beside the title, not in the form.
    expect(within(form).queryByText("Draft")).toBeNull();
    expect(
      screen
        .getAllByText("Draft")
        .some((node) => node.closest("[data-family]")),
    ).toBe(true);
    expect(screen.getByRole("tab", { name: /Checks/ })).toBeVisible();
  });

  it("opens a blank order with the next number after Save and new", async () => {
    const user = userEvent.setup();
    renderApp("/gallery", { session: sessionFor("SUPPORT") });
    const form = await screen.findByRole("form", { name: "Sales order" });
    const po = within(form).getByRole("textbox", {
      name: /Customer PO number/,
    });
    expect(po).toHaveValue("CPO-7731");
    await user.clear(po);
    await user.type(po, "CPO-8800");
    await user.click(
      within(form).getByRole("button", { name: "Save and new" }),
    );
    expect(await screen.findByText(/A new order is ready/)).toBeVisible();
    expect(po).toHaveValue("");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Sales order SO-20261106-0002",
      }),
    ).toBeVisible();
    // A blank order has no record yet: nothing attached, no steps and no
    // checks, and nothing to submit, print or void until it is saved.
    expect(screen.queryByText("Customer PO as received.pdf")).toBeNull();
    expect(screen.getByText("No attachments yet.")).toBeVisible();
    expect(
      screen.getByText("No steps yet. They appear as the document moves."),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Checks" })).toBeVisible();
    for (const name of ["Submit for approval", "Print or PDF", "Void"]) {
      const button = within(form).getByRole("button", { name });
      expect(button, name).toHaveAttribute("aria-disabled", "true");
      expect(button, name).toHaveAccessibleDescription("Save the order first.");
    }
  }, 20_000);

  it("blocks Save on an approved order and says why", async () => {
    const user = userEvent.setup();
    renderApp("/gallery", { session: sessionFor("APPROVER") });
    const form = await screen.findByRole("form", { name: "Sales order" });
    await user.click(
      within(form).getByRole("button", { name: "Submit for approval" }),
    );
    await user.click(
      await within(form).findByRole("button", { name: "Approve" }),
    );
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(within(form).getByRole("status")).toHaveTextContent(
        "An approved order cannot be changed.",
      ),
    );
  }, 20_000);

  it("lets the table be forced into its states", async () => {
    const user = userEvent.setup();
    renderApp("/gallery", { session: sessionFor("AUDITOR") });
    await screen.findByRole("heading", { level: 1, name: "Component gallery" });
    const table = screen.getByRole("table", { name: "Orders" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    await user.click(screen.getByRole("button", { name: "Show an error" }));
    expect(screen.getByText("trace-demo-0001")).toBeVisible();
    const region = screen.getByRole("region", {
      name: "Orders, scrollable table",
    });
    await user.click(within(region).getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("table", { name: "Orders" })).toBeVisible();
  });

  it("runs its one primary action from the N key", async () => {
    const user = userEvent.setup();
    renderApp("/gallery", { session: sessionFor("AUDITOR") });
    await screen.findByRole("heading", { level: 1, name: "Component gallery" });
    await user.keyboard("n");
    expect(await screen.findByText(/The primary action ran/)).toBeVisible();
  });

  it("does not exist for a real session in a production build", async () => {
    vi.stubEnv("DEV", false);
    renderApp("/gallery", {
      session: { ...sessionFor("AUDITOR"), demo: false },
    });
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});
