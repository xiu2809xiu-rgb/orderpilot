import { afterEach, describe, expect, it } from "vitest";
import { clearTablePrefs, restoreTablePrefs } from "./localPrefs";

afterEach(() => {
  localStorage.clear();
});

describe("clearTablePrefs", () => {
  it("removes only this person's table layouts and leaves every other key", () => {
    localStorage.setItem("op.table.orders.u1", '{"hidden":["a"]}');
    localStorage.setItem("op.table.items.u1", '{"order":["b"]}');
    localStorage.setItem("op.table.orders.u2", '{"hidden":["c"]}');
    localStorage.setItem("op-theme", "dark");
    localStorage.setItem("op-dx-panel-collapsed", "1");

    const removed = clearTablePrefs("u1");

    expect(removed.map(([key]) => key).sort()).toEqual([
      "op.table.items.u1",
      "op.table.orders.u1",
    ]);
    expect(localStorage.getItem("op.table.orders.u1")).toBeNull();
    expect(localStorage.getItem("op.table.items.u1")).toBeNull();
    expect(localStorage.getItem("op.table.orders.u2")).toBe('{"hidden":["c"]}');
    expect(localStorage.getItem("op-theme")).toBe("dark");
    expect(localStorage.getItem("op-dx-panel-collapsed")).toBe("1");
  });

  it("returns nothing when no layout was saved", () => {
    localStorage.setItem("op-theme", "dark");
    expect(clearTablePrefs("u1")).toEqual([]);
  });

  it("puts back exactly what it removed", () => {
    localStorage.setItem("op.table.orders.u1", '{"hidden":["a"]}');
    const removed = clearTablePrefs("u1");
    restoreTablePrefs(removed);
    expect(localStorage.getItem("op.table.orders.u1")).toBe('{"hidden":["a"]}');
  });
});
