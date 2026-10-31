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
  it("shows every component to a demo session", async () => {
    const user = userEvent.setup();
    const { container } = renderApp("/gallery", {
      session: sessionFor("AUDITOR"),
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Component gallery",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("Synthetic demo data").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Mock AI")).toBeVisible();
    expect(screen.getByText("Requires approval")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Operation log" }),
    ).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);

    // The table is served by the fake server, and its states can be forced.
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
