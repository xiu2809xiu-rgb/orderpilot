import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { recordFromMatches } from "@/lib/resolveRecord";
import { canonicalOrderAddress, orderRoutes } from "./routes";

/** What the strip of open records reads of an address: the record it declares, if any. */
function recordAt(pathname: string) {
  const matches = matchRoutes(
    [{ path: "/orders", handle: { crumb: "Orders" }, children: orderRoutes }],
    pathname,
  );
  return matches
    ? recordFromMatches(
        matches.map((match) => ({
          pathname: match.pathname,
          params: match.params,
          handle: match.route.handle,
        })),
      )
    : null;
}

describe("the order routes", () => {
  it("make an order's page a record, so it opens as a tab named by its number", () => {
    expect(recordAt("/orders/SO-0082")).toEqual({
      key: "/orders/SO-0082",
      kind: "order",
      no: "SO-0082",
      listPath: "/orders",
    });
  });

  it("keep the form for a new order out of the strip", () => {
    expect(recordAt("/orders/new")).toBeNull();
  });
});

describe("canonicalOrderAddress", () => {
  const run = (path: string) =>
    canonicalOrderAddress({
      params: { orderNo: path.split(/[?#]/)[0]?.split("/").pop() ?? "" },
      request: new Request(`http://localhost/orders/${path}`),
      context: undefined,
    } as never);

  it("sends a lower-case number to its capitals, keeping the query", () => {
    const answer = run("so-0082?tab=documents");
    if (!(answer instanceof Response)) throw new Error("no redirect");
    expect(answer.headers.get("Location")).toBe(
      "/orders/SO-0082?tab=documents",
    );
  });

  it("lets a number that is already right through", () => {
    expect(run("SO-0082")).toBeNull();
  });

  it("leaves an address that cannot be an order number to the page, which says so", () => {
    expect(run("so_0082")).toBeNull();
  });
});
