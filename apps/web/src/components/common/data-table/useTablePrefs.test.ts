import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { DEFAULT_QUERY } from "./types";
import { useTablePrefs } from "./useTablePrefs";

afterEach(() => {
  localStorage.clear();
  useSessionStore.setState({ status: "booting", session: null });
});

describe("useTablePrefs", () => {
  it("follows the viewer when the key changes while mounted", () => {
    const other = sessionFor("FINANCE");
    localStorage.setItem(
      `op.table.t.${other.user.id}`,
      JSON.stringify({ hidden: ["b"], saved: [] }),
    );
    const { result } = renderHook(() => useTablePrefs("t"));
    act(() => {
      result.current.setHidden(["a"]);
    });
    expect(result.current.hidden).toEqual(["a"]);

    act(() => {
      useSessionStore.getState().setSession(other);
    });
    expect(result.current.hidden).toEqual(["b"]);
    // Nothing of the anonymous viewer was copied under the new key.
    expect(
      JSON.parse(localStorage.getItem(`op.table.t.${other.user.id}`) ?? "{}"),
    ).toEqual({ hidden: ["b"], saved: [] });
  });

  it("reads a copy saved before views kept columns, and its views leave the columns alone", () => {
    const viewer = sessionFor("SUPPORT");
    useSessionStore.getState().setSession(viewer);
    const old = {
      id: "v1",
      name: "Old",
      search: "x",
      filters: {},
      sort: null,
    };
    localStorage.setItem(
      `op.table.t.${viewer.user.id}`,
      JSON.stringify({ hidden: ["b"], saved: [old] }),
    );
    const { result } = renderHook(() => useTablePrefs("t"));
    expect(result.current.order).toBeNull();
    expect(result.current.saved).toEqual([old]);
    act(() => {
      result.current.applyColumns(old);
    });
    expect(result.current.hidden).toEqual(["b"]);
  });

  it("saves a view with the columns as they are, and applies them again", () => {
    useSessionStore.getState().setSession(sessionFor("SUPPORT"));
    const { result } = renderHook(() => useTablePrefs("t"));
    act(() => {
      result.current.setHidden(["c"]);
      result.current.setOrder(["b", "a"]);
    });
    act(() => {
      result.current.saveView("Mine", { ...DEFAULT_QUERY, search: "quillon" });
    });
    const [view] = result.current.saved;
    expect(view).toMatchObject({
      name: "Mine",
      search: "quillon",
      hidden: ["c"],
      order: ["b", "a"],
    });
    act(() => {
      result.current.resetColumns();
    });
    expect(result.current.hidden).toBeNull();
    expect(result.current.order).toBeNull();
    act(() => {
      if (view) result.current.applyColumns(view);
    });
    expect(result.current.order).toEqual(["b", "a"]);
    expect(result.current.hidden).toEqual(["c"]);
  });
});
