import { ROLES, type Permission, type Session } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { menuFor } from "@/features/nav";
import { sessionFor } from "@/test/fixtures";
import {
  GROUP_IDS,
  ORDERS_ENTRY_ID,
  TRACKER_ENTRY_ID,
  currentGroup,
  isRowCurrent,
  panelMenu,
} from "./panelMenu";

function without(session: Session, permission: Permission): Session {
  return {
    ...session,
    permissions: session.permissions.filter((held) => held !== permission),
  };
}

const at = (pathname: string, search = "") => ({ pathname, search });

describe.each(ROLES)("the panel menu of %s", (role) => {
  const session = sessionFor(role);
  const real = menuFor(session).map((entry) => entry.id);
  const groups = panelMenu(session);
  const rows = groups.flatMap((group) => group.rows);

  it("keeps every entry the role has, once", () => {
    const covered = rows.flatMap((row) => row.covers.map((entry) => entry.id));
    expect([...covered].sort()).toEqual([...real].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it("shows Orders once where the role has Orders and the order tracker", () => {
    const ids = rows.map((row) => row.entry.id);
    const both =
      real.includes(ORDERS_ENTRY_ID) && real.includes(TRACKER_ENTRY_ID);
    if (both) {
      expect(ids.filter((id) => id === ORDERS_ENTRY_ID)).toHaveLength(1);
      expect(ids).not.toContain(TRACKER_ENTRY_ID);
    }
    for (const row of rows) {
      const stands = row.covers.map((entry) => entry.id);
      expect(stands).toEqual(
        both && row.entry.id === ORDERS_ENTRY_ID
          ? [ORDERS_ENTRY_ID, TRACKER_ENTRY_ID]
          : [row.entry.id],
      );
    }
  });

  it("uses only the four groups, in order, and none of them empty", () => {
    const ids = groups.map((group) => group.id);
    expect(ids).toEqual(GROUP_IDS.filter((id) => ids.includes(id)));
    for (const group of groups) expect(group.rows.length).toBeGreaterThan(0);
  });

  it("puts Home first, and gives every row a real address", () => {
    expect(groups[0]?.id).toBe("work");
    expect(groups[0]?.rows[0]?.entry.id).toBe("home");
    for (const row of rows) expect(row.entry.to, row.entry.id).toMatch(/^\//);
  });
});

describe("the panel menu in detail", () => {
  it("groups Support's menu by what people are doing", () => {
    const groups = panelMenu(sessionFor("SUPPORT"));
    expect(
      groups.map((group) => [group.id, group.rows.map((row) => row.entry.id)]),
    ).toEqual([
      [
        "work",
        ["home", "workflows.myTasks", ORDERS_ENTRY_ID, "exceptions.exceptions"],
      ],
      [
        "stock",
        ["master-data.customers", "master-data.vendors", "master-data.items"],
      ],
    ]);
  });

  it("puts the KPIs of Management under insights", () => {
    const insights = panelMenu(sessionFor("MANAGEMENT")).find(
      (group) => group.id === "insights",
    );
    expect(insights?.rows.map((row) => row.entry.id)).toEqual([
      "insights.kpis",
    ]);
  });

  it("keeps the tracker's own row for a role that may not read orders", () => {
    const session = without(sessionFor("WAREHOUSE"), "orders.read");
    const ids = panelMenu(session)
      .flatMap((group) => group.rows)
      .map((row) => row.entry.id);
    expect(ids).toContain(TRACKER_ENTRY_ID);
    expect(ids).not.toContain(ORDERS_ENTRY_ID);
  });

  it("keeps Orders current on an order, a new order and the tracker's pages", () => {
    const groups = panelMenu(sessionFor("SUPPORT"));
    const orders = groups
      .flatMap((group) => group.rows)
      .find((row) => row.entry.id === ORDERS_ENTRY_ID);
    if (!orders) throw new Error("Support has no Orders row");
    for (const pathname of [
      "/orders",
      "/orders/new",
      "/orders/SO-0001",
      "/order-tracker",
      "/order-tracker/SO-0001",
    ]) {
      expect(isRowCurrent(orders, at(pathname)), pathname).toBe(true);
    }
    expect(isRowCurrent(orders, at("/"))).toBe(false);
    expect(isRowCurrent(orders, at("/exceptions"))).toBe(false);
  });

  it("names the group of the page a person is on, and none for a page outside the menu", () => {
    const groups = panelMenu(sessionFor("MANAGEMENT"));
    expect(currentGroup(groups, at("/"))).toBe("work");
    expect(currentGroup(groups, at("/orders/SO-0001"))).toBe("work");
    expect(currentGroup(groups, at("/insights"))).toBe("insights");
    expect(currentGroup(groups, at("/settings"))).toBeUndefined();
    expect(currentGroup(groups, at("/nowhere"))).toBeUndefined();
  });
});
