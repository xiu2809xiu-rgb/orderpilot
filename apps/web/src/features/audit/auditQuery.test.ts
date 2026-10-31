import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, type TableQuery } from "@/components/common";
import { toListRequest } from "./auditQuery";

function queryWith(patch: Partial<TableQuery>): TableQuery {
  return { ...DEFAULT_QUERY, ...patch };
}

describe("toListRequest", () => {
  it("sends the page and nothing else when no filter is set", () => {
    expect(toListRequest(queryWith({ pageSize: 25 }))).toEqual({
      params: { page: 1, pageSize: 25 },
      problem: null,
    });
  });

  it("maps each filter to the API's name", () => {
    const { params, problem } = toListRequest(
      queryWith({
        search: " refused ",
        filters: {
          entity: "User",
          id: "u-1",
          kind: "user",
          role: "FINANCE",
          action: "auth.",
          refusals: true,
        },
      }),
    );
    expect(problem).toBeNull();
    expect(params).toMatchObject({
      entityType: "User",
      entityId: "u-1",
      actorKind: "user",
      role: "FINANCE",
      action: "auth.",
      refusalsOnly: "true",
      search: "refused",
    });
  });

  it("turns a day range into an inclusive time range", () => {
    const { params } = toListRequest(
      queryWith({ filters: { from: "2026-11-01", to: "2026-11-01" } }),
    );
    expect(params.from).toBeDefined();
    expect(params.to).toBeDefined();
    expect(String(params.from) < String(params.to)).toBe(true);
  });

  it("does not send a range that ends before it starts", () => {
    const result = toListRequest(
      queryWith({ filters: { from: "2026-11-02", to: "2026-11-01" } }),
    );
    expect(result.problem).toBe("range");
  });

  it("does not send an actor that is not an id, or a day that is not a date", () => {
    expect(
      toListRequest(queryWith({ filters: { actor: "angelyn" } })).problem,
    ).toBe("actor");
    expect(
      toListRequest(queryWith({ filters: { from: "2026-13-45" } })).problem,
    ).toBe("date");
    expect(
      toListRequest(
        queryWith({
          filters: { actor: "0194f3a0-0000-7000-8000-000000000001" },
        }),
      ).params.actorUserId,
    ).toBe("0194f3a0-0000-7000-8000-000000000001");
  });
});
