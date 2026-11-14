import { describe, expect, it } from "vitest";
import { routeKindOf } from "./routeKind";

describe("routeKindOf", () => {
  it.each([
    ["/", "home"],
    ["/settings", "settings"],
    ["/settings/", "settings"],
    ["/orders", "list"],
    ["/master-data/customers", "list"],
    ["/orders/SO-0110", "record"],
    ["/master-data/customers/C-1001", "record"],
    ["/workflows/sprs/SPR-1", "record"],
    ["/orders/new", "form"],
    ["/master-data/items/new", "form"],
    ["/nowhere", "list"],
  ])("draws %s as a %s", (path, kind) => {
    expect(routeKindOf(path)).toBe(kind);
  });
});
