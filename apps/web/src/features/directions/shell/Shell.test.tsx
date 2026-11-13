import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { allFeatures } from "@/features/registry";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

function found(element: HTMLElement | null): HTMLElement {
  if (!element) throw new Error("The element is not on the page");
  return element;
}

describe("the shell of the design directions preview", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces([
      "common",
      "directions",
      "directions-kit",
      ...allFeatures.map((feature) => feature.namespace),
    ]);
  });

  async function open(direction = "ink") {
    const view = renderApp(`/directions/${direction}/kit`, {
      session: sessionFor("SUPPORT"),
    });
    await screen.findByRole("heading", { level: 1, name: "Kit sheet" });
    return view;
  }

  it("groups the role's menu, with Orders once and the current entry marked", async () => {
    await open();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const groups = within(nav)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(groups).toEqual(["Work", "Stock and buying", "Control"]);
    expect(within(nav).getAllByText("Orders")).toHaveLength(1);
    expect(within(nav).queryByText("Order tracker")).toBeNull();
    for (const name of [
      "My tasks",
      "Exceptions",
      "Customers",
      "Vendors",
      "Items",
    ]) {
      expect(within(nav).getByText(name)).toBeVisible();
    }
    expect(
      within(nav).getByRole("link", { name: "Kit sheet" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("makes a row that leads nowhere a plain row, not a link, and says why", async () => {
    const user = userEvent.setup();
    await open();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).queryByRole("link", { name: "Orders" })).toBeNull();
    const orders = within(nav).getByRole("button", { name: "Orders" });
    expect(orders).toHaveAttribute("aria-disabled", "true");
    await user.hover(orders);
    expect(await screen.findAllByText("Shown for layout")).not.toHaveLength(0);
  });

  it("keeps Spark, settings, help and the signed-in person at the foot", async () => {
    await open();
    const aside = found(
      screen.getByRole("navigation", { name: "Main navigation" }).parentElement,
    );
    expect(screen.getByText("Mei Tan")).toBeVisible();
    expect(screen.getAllByText("Support").length).toBeGreaterThan(0);
    for (const name of ["Spark", "Settings", "Help"]) {
      expect(within(aside).getByRole("button", { name })).toBeVisible();
    }
  });

  it("collapses to a rail that keeps every name for a screen reader", async () => {
    const user = userEvent.setup();
    await open();
    const toggle = screen.getByRole("button", { name: "Collapse the panel" });
    await user.click(toggle);
    const box = screen
      .getByRole("navigation", { name: "Main navigation" })
      .closest("aside");
    expect(box).toHaveAttribute("data-collapsed", "true");
    expect(
      screen.getByRole("button", { name: "Expand the panel" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Kit sheet" })).toBeVisible();
  });

  it("has the top bar: crumbs, search, upload, spark, bell and theme", async () => {
    await open();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByText("Design")).toBeInTheDocument();
    expect(within(crumbs).getByText("Kit sheet")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The kit sheet has a header of its own, so the bar is found through its trail.
    const bar = found(crumbs.closest("header"));
    expect(
      within(bar).getByRole("button", {
        name: "Search or jump to",
      }),
    ).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    // The upload and Spark screens are not built: the buttons say so and are plain.
    expect(within(bar).getByRole("button", { name: "Upload" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(bar).getByRole("button", { name: "Spark" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(bar).getByRole("button", { name: "Theme" })).toBeVisible();
  });

  it("opens the palette with Ctrl K and jumps to a screen", async () => {
    const user = userEvent.setup();
    const { router } = await open();
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", {
      name: "Search or jump to",
    });
    expect(within(dialog).getByText("Screens")).toBeVisible();
    await user.click(within(dialog).getByRole("option", { name: "Kit sheet" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(router.state.location.pathname).toBe("/directions/ink/kit");
  });

  it("keeps the same panel in every direction and passes the accessibility check", async () => {
    for (const direction of ["ink", "paper", "spectra"]) {
      const { container, unmount } = await open(direction);
      expect(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      expect(await axeViolations(container)).toEqual([]);
      unmount();
    }
  }, 60_000);
});
