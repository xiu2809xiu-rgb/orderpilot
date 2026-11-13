import { ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { menuFor } from "@/features/nav";
import { sessionFor } from "@/test/fixtures";
import { GROUP_IDS, KIT_ENTRY_ID, panelMenu, type PanelEntry } from "./menu";

/** Today's two entries for the same orders, spelled out so the test does not trust the code. */
const TODAYS_ORDER_ENTRIES = ["orders.orders", "order-tracker.tracker"];

const shownIds = (entries: readonly PanelEntry[]) =>
  entries.flatMap((entry) => entry.sources);

describe.each(ROLES)("the panel menu of %s", (role) => {
  const session = sessionFor(role);
  const real = menuFor(session).map((entry) => entry.id);
  const groups = panelMenu(session);
  const entries = groups.flatMap((group) => group.entries);

  it("keeps every entry the role has today, once", () => {
    const shown = shownIds(entries).filter((id) => id !== KIT_ENTRY_ID);
    expect([...shown].sort()).toEqual([...real].sort());
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("shows Orders once where today there are Orders and the Order tracker", () => {
    const orders = entries.filter((entry) => entry.id === "orders");
    const has = TODAYS_ORDER_ENTRIES.filter((id) => real.includes(id));
    expect(orders).toHaveLength(has.length > 0 ? 1 : 0);
    expect(orders[0]?.sources ?? []).toEqual(has);
    // No row of its own is left for either of them.
    expect(entries.map((entry) => entry.id)).not.toContain(
      "order-tracker.tracker",
    );
    expect(orders[0]?.label ?? "directions:panel.orders").toBe(
      "directions:panel.orders",
    );
  });

  it("uses only the four groups, in order, and none of them empty", () => {
    const ids = groups.map((group) => group.id);
    expect(ids).toEqual(GROUP_IDS.filter((id) => ids.includes(id)));
    for (const group of groups) expect(group.entries.length).toBeGreaterThan(0);
  });

  it("puts Home and the work lists first, and the kit sheet last in control", () => {
    expect(groups[0]?.id).toBe("work");
    expect(groups[0]?.entries[0]?.id).toBe("home");
    const control = groups.find((group) => group.id === "control");
    expect(control?.entries.at(-1)?.id).toBe(KIT_ENTRY_ID);
  });

  it("gives no row an address while no screen is built", () => {
    for (const entry of panelMenu(session, () => false).flatMap(
      (group) => group.entries,
    )) {
      expect(entry.screen, entry.id).toBeUndefined();
    }
  });
});

describe("the panel menu in detail", () => {
  it("groups Support's menu by what people are doing", () => {
    const groups = panelMenu(sessionFor("SUPPORT"));
    expect(
      groups.map((group) => [group.id, group.entries.map((e) => e.id)]),
    ).toEqual([
      [
        "work",
        ["home", "workflows.myTasks", "orders", "exceptions.exceptions"],
      ],
      [
        "stock",
        ["master-data.customers", "master-data.vendors", "master-data.items"],
      ],
      ["control", [KIT_ENTRY_ID]],
    ]);
  });

  it("opens a screen of the preview only where one is built", () => {
    const only = (...ids: string[]) =>
      panelMenu(sessionFor("SUPPORT"), (id) => ids.includes(id)).flatMap(
        (group) => group.entries.filter((entry) => entry.screen),
      );
    expect(only("kit").map((entry) => entry.id)).toEqual([KIT_ENTRY_ID]);
    expect(only("kit", "orders", "home").map((entry) => entry.screen)).toEqual([
      "home",
      "orders",
      "kit",
    ]);
  });

  it("puts the KPIs of Management under insights", () => {
    const insights = panelMenu(sessionFor("MANAGEMENT")).find(
      (group) => group.id === "insights",
    );
    expect(insights?.entries.map((entry) => entry.id)).toEqual([
      "insights.kpis",
    ]);
  });
});
