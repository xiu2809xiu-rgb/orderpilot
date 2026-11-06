import { screen, within } from "@testing-library/react";
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
    expect(within(form).getByText("Draft")).toBeVisible();
    expect(screen.getByRole("tab", { name: /Checks/ })).toBeVisible();
  });

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
