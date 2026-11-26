import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  parseQuery,
  stageStatusValue,
  statusCodes,
  toggleStatus,
} from "./ordersQuery";
import { fromSavedView, toSavedQuery } from "./savedViews";

// Several statuses at once, held as the address and a saved view hold them.

const PAYMENT = "sample-awaiting-payment";
const PI = "sample-pi-to-send";
const MISMATCH = "sample-packing-list-mismatch";
const SHIPPED = "sample-shipped";

describe("toggleStatus", () => {
  it("adds a status and keeps the lifecycle's order, whatever order they were pressed in", () => {
    const first = toggleStatus(null, MISMATCH);
    expect(first.status).toBe(MISMATCH);
    const second = toggleStatus(first.status ?? null, PI);
    expect(second.status).toBe(`${PI},${MISMATCH}`);
    expect(second.stage).toBe("processing");
  });

  it("takes a status off, and is no filter when the last goes", () => {
    expect(toggleStatus(`${PI},${MISMATCH}`, PI).status).toBe(MISMATCH);
    expect(toggleStatus(PI, PI)).toEqual({ status: null, stage: "all" });
  });

  it("names no stage when the statuses are from several, so the address and the list agree", () => {
    expect(toggleStatus(PI, SHIPPED)).toEqual({
      status: `${PI},${SHIPPED}`,
      stage: "all",
    });
  });

  it("keeps a status the lifecycle does not list, after the ones it does", () => {
    expect(toggleStatus("odd-code", PI).status).toBe(`${PI},odd-code`);
  });
});

describe("the Stage and status list", () => {
  const of = (status: string | null) =>
    stageStatusValue({
      ...DEFAULT_QUERY,
      ...parseQuery(new URLSearchParams(status ? { status } : {})),
    });

  it("still shows a whole stage, one status, or everything", () => {
    expect(of(null)).toBe("all");
    expect(of(PI)).toBe(`status:${PI}`);
    expect(
      of(
        "sample-pi-to-send,sample-awaiting-payment,sample-ready-to-pick,sample-packing-list-mismatch",
      ),
    ).toBe("stage:processing");
  });

  it("shows nothing chosen for several statuses that are not a whole stage", () => {
    expect(of(`${PAYMENT},${MISMATCH}`)).toBe("");
  });
});

describe("a saved view of several statuses", () => {
  it("keeps the list and opens the same one", () => {
    const query = {
      ...DEFAULT_QUERY,
      ...parseQuery(new URLSearchParams({ status: `${PAYMENT},${MISMATCH}` })),
    };
    const saved = toSavedQuery(query);
    expect(saved.filters.status).toBe(`${PAYMENT},${MISMATCH}`);
    const back = fromSavedView({
      id: "v1",
      name: "Payment or mismatch",
      search: saved.search,
      filters: saved.filters,
      sort: saved.sort,
    });
    expect(back.status).toBe(`${PAYMENT},${MISMATCH}`);
    expect(statusCodes(back.status)).toEqual([PAYMENT, MISMATCH]);
  });
});
