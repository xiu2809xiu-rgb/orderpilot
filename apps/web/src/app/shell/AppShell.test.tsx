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

// Settings is the lightest real page, so these tests are about the frame
// around it: the panel, the bar and what they open.
describe("the shell around every page", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces([
      "common",
      "directions-spark",
      "directions-parts",
      ...allFeatures.map((feature) => feature.namespace),
    ]);
  });

  async function open(role: Parameters<typeof sessionFor>[0] = "SUPPORT") {
    const view = renderApp("/settings", { session: sessionFor(role) });
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    return view;
  }

  it("has the panel beside the page, with the open page marked", async () => {
    await open();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(found(nav.closest("aside"))).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(within(nav).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("has the top bar: the trail, search, upload, Spark, the bell and the theme", async () => {
    await open();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByText("Settings")).toHaveAttribute(
      "aria-current",
      "page",
    );
    // A top-level page shows its own name alone: the panel is the way back.
    expect(within(crumbs).queryByRole("link")).toBeNull();
    const bar = found(crumbs.closest("header"));
    expect(
      within(bar).getByRole("button", { name: "Search or jump to" }),
    ).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    expect(within(bar).getByRole("link", { name: "Upload" })).toHaveAttribute(
      "href",
      "/upload",
    );
    expect(within(bar).getByRole("button", { name: "Spark" })).toBeVisible();
    expect(
      within(bar).getByRole("button", { name: /^Notifications/ }),
    ).toBeVisible();
    expect(within(bar).getByRole("button", { name: "Theme" })).toBeVisible();
  });

  it("offers Upload only to a role that may upload documents", async () => {
    await open("MANAGEMENT");
    expect(screen.queryByRole("link", { name: "Upload" })).toBeNull();
    // Spark is there for every role, once, in the bar.
    expect(screen.getAllByRole("button", { name: "Spark" })).toHaveLength(1);
  });

  it("collapses the panel to a rail and opens it again", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(
      screen.getByRole("button", { name: "Collapse the panel" }),
    );
    const box = screen
      .getByRole("navigation", { name: "Main navigation" })
      .closest("aside");
    expect(box).toHaveAttribute("data-collapsed", "true");
    // The rail keeps every name for a screen reader.
    expect(screen.getByRole("link", { name: "Orders" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand the panel" }));
    expect(box).toHaveAttribute("data-collapsed", "false");
  });

  it("opens the palette from the search field and goes where the panel goes", async () => {
    const user = userEvent.setup();
    const { router } = await open();
    await user.click(screen.getByRole("button", { name: "Search or jump to" }));
    const places = await screen.findByRole("group", { name: "Go to" });
    const names = within(places)
      .getAllByRole("option")
      .map((option) => option.textContent);
    // The same places as the panel: Orders once, and no order tracker. A demo
    // session adds the two demo tools of the top bar at the end.
    expect(names).toEqual([
      "Home",
      "My tasks",
      "Orders",
      "Exceptions",
      "Customers",
      "Vendors",
      "Items",
      "Settings",
      "Upload",
      "Spark",
    ]);
    await user.click(within(places).getByRole("option", { name: "Customers" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/master-data/customers");
    });
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

  it("passes the accessibility check", async () => {
    const { container } = await open();
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});
