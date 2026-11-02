import { beforeEach, describe, expect, it } from "vitest";
import type { RecordRef } from "@/lib/records";
import { must } from "@/test/must";
import { storageKey, useRecordTabs } from "./recordTabs";

const ITEM: RecordRef = {
  key: "/items/ITM-001",
  kind: "item",
  no: "ITM-001",
  listPath: "/items",
};

const VIEWER = "viewer-1";

function stored(tab: Record<string, unknown>) {
  localStorage.setItem(
    storageKey(VIEWER),
    JSON.stringify([{ ...ITEM, to: ITEM.key, dirty: false, ...tab }]),
  );
}

function loaded() {
  useRecordTabs.setState({ owner: null, tabs: [] });
  useRecordTabs.getState().load(VIEWER);
  return useRecordTabs.getState().tabs;
}

beforeEach(() => {
  localStorage.clear();
  useRecordTabs.setState({ owner: null, tabs: [] });
  useRecordTabs.getState().load(VIEWER);
});

describe("unsaved changes reported before the tab exists", () => {
  it("opens the tab already marked", () => {
    useRecordTabs.getState().setDirty(ITEM.key, true);
    useRecordTabs.getState().open(ITEM, ITEM.key);
    expect(must(useRecordTabs.getState().tabs[0]).dirty).toBe(true);
  });

  it("forgets a mark that was cleared before the tab opened", () => {
    useRecordTabs.getState().setDirty(ITEM.key, true);
    useRecordTabs.getState().setDirty(ITEM.key, false);
    useRecordTabs.getState().open(ITEM, ITEM.key);
    expect(must(useRecordTabs.getState().tabs[0]).dirty).toBe(false);
  });

  it("does not carry a mark over to the next viewer", () => {
    useRecordTabs.getState().setDirty(ITEM.key, true);
    useRecordTabs.getState().load("viewer-2");
    useRecordTabs.getState().open(ITEM, ITEM.key);
    expect(must(useRecordTabs.getState().tabs[0]).dirty).toBe(false);
  });

  it("does not carry a mark over to a tab closed and opened again", () => {
    useRecordTabs.getState().open(ITEM, ITEM.key);
    useRecordTabs.getState().setDirty(ITEM.key, true);
    useRecordTabs.getState().close(ITEM.key);
    useRecordTabs.getState().open(ITEM, ITEM.key);
    expect(must(useRecordTabs.getState().tabs[0]).dirty).toBe(false);
  });
});

describe("tabs read back from storage", () => {
  it("keeps a good copy, with its query", () => {
    stored({ to: `${ITEM.key}?tab=orders` });
    expect(loaded()).toHaveLength(1);
  });

  it.each([
    ["an address off the site", { to: "https://example.test/x" }],
    ["a protocol-relative address", { to: "//example.test/x" }],
    ["a list path off the site", { listPath: "https://example.test/" }],
    ["a list path that is protocol-relative", { listPath: "//example.test" }],
    ["a key that is not a path", { key: "items/ITM-001" }],
    ["an address of another record", { to: "/items/ITM-002" }],
    ["an address that only starts like the key", { to: "/items/ITM-0010" }],
  ])("drops %s", (_, tab) => {
    stored(tab);
    expect(loaded()).toEqual([]);
  });
});
