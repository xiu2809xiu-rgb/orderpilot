import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
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
});
