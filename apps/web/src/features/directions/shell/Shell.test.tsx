import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { allFeatures } from "@/features/registry";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { renderApp } from "@/test/render";

// This file tests the shell, not the kit sheet. The real sheet is a heavy lazy
// screen (canvases, every kit item): waiting for it made these tests depend on
// how busy the machine was. A stand-in with the same heading keeps the crumb
// and the current entry honest without that cost.
vi.mock("../kit/KitScreen", () => ({
  default: () => <h1>Kit sheet</h1>,
}));

function found(element: HTMLElement | null): HTMLElement {
  if (!element) throw new Error("The element is not on the page");
  return element;
}

describe("the shell of the prototype screens", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces([
      "common",
      "directions",
      "directions-kit",
      "directions-kit-items",
      "directions-parts",
      "directions-spark",
      ...allFeatures.map((feature) => feature.namespace),
    ]);
  });

  async function open() {
    const view = renderApp("/preview/kit", {
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
    // Orders has its screen now, so it is a link; Customers has none yet.
    expect(within(nav).getByRole("link", { name: "Orders" })).toBeVisible();
    expect(within(nav).queryByRole("link", { name: "Customers" })).toBeNull();
    const customers = within(nav).getByRole("button", { name: "Customers" });
    expect(customers).toHaveAttribute("aria-disabled", "true");
    await user.hover(customers);
    expect(await screen.findAllByText("Shown for layout")).not.toHaveLength(0);
  });

  it("keeps settings, help and the signed-in person at the foot, and Spark only in the top bar", async () => {
    await open();
    const aside = found(
      screen.getByRole("navigation", { name: "Main navigation" }).parentElement,
    );
    expect(screen.getByText("Mei Tan")).toBeVisible();
    expect(screen.getAllByText("Support").length).toBeGreaterThan(0);
    for (const name of ["Settings", "Help"]) {
      expect(within(aside).getByRole("button", { name })).toBeVisible();
    }
    // One Spark on the screen, in the bar: the panel's foot has none.
    expect(within(aside).queryByRole("button", { name: "Spark" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Spark" })).toHaveLength(1);
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
    // Upload leads to the upload screen, and Spark opens its panel.
    expect(within(bar).getByRole("link", { name: "Upload" })).toHaveAttribute(
      "href",
      "/preview/upload",
    );
    expect(
      within(bar).getByRole("button", { name: "Spark" }),
    ).not.toHaveAttribute("aria-disabled");
    expect(within(bar).getByRole("button", { name: "Theme" })).toBeVisible();
  });

  it("opens Spark from its button and with Ctrl and a full stop, and closes it with Escape", async () => {
    const user = userEvent.setup();
    await open();
    // Spark is not mounted until it has been asked for.
    expect(screen.queryByRole("dialog", { name: "Spark" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Spark" }));
    expect(await screen.findByRole("dialog", { name: "Spark" })).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Spark" })).toBeNull();
    });
    // The shortcut opens it again, and the same key puts it away.
    await user.keyboard("{Control>}.{/Control}");
    expect(await screen.findByRole("dialog", { name: "Spark" })).toBeVisible();
    await user.keyboard("{Control>}.{/Control}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Spark" })).toBeNull();
    });
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
    expect(router.state.location.pathname).toBe("/preview/kit");
  });

  it("passes the accessibility check", async () => {
    const { container } = await open();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});
