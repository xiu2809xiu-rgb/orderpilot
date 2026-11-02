import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY } from "./types";
import { queryFromUrl, urlFromQuery, useUrlQuery } from "./useUrlQuery";

const SPEC = { brand: null, availability: ["short", "low", "ok"] } as const;

describe("a list's address", () => {
  it("falls back to the default page size when a hand-edited one is refused by the API", () => {
    const size = (value: string) =>
      queryFromUrl(new URLSearchParams({ pageSize: value }), SPEC, {
        pageSize: 25,
      }).pageSize;
    expect(size("500")).toBe(25);
    expect(size("200")).toBe(200);
    expect(size("50")).toBe(50);
    expect(size("-3")).toBe(25);
    expect(size("abc")).toBe(25);
    expect(size("2.5")).toBe(25);
  });

  it("drops a page, a filter value and a direction that mean nothing", () => {
    const query = queryFromUrl(
      new URLSearchParams(
        "page=0&availability=gone&brand=Acme&direction=sideways&sort=name",
      ),
      SPEC,
    );
    expect(query.page).toBe(1);
    expect(query.filters).toEqual({ brand: "Acme" });
    expect(query.sort).toEqual({ columnId: "name", direction: "asc" });
  });

  it("reads a plain list of names as filters that take any text, and true as a switch", () => {
    const query = queryFromUrl(
      new URLSearchParams("status=NEW&overdue=true&other=1"),
      ["status", "overdue"],
    );
    expect(query.filters).toEqual({ status: "NEW", overdue: true });
  });

  it("writes only what differs from the defaults and leaves other parameters alone", () => {
    const written = urlFromQuery(
      new URLSearchParams("tab=history&page=3&brand=old"),
      {
        ...DEFAULT_QUERY,
        search: "switch",
        filters: { brand: "Acme", overdue: true },
        sort: { columnId: "name", direction: "desc" },
      },
      ["brand", "overdue"],
    );
    expect(Object.fromEntries(written)).toEqual({
      tab: "history",
      search: "switch",
      brand: "Acme",
      overdue: "true",
      sort: "name",
      direction: "desc",
    });
  });
});

function Probe() {
  const [query, setQuery] = useUrlQuery(SPEC, { pageSize: 25 });
  const { search } = useLocation();
  return (
    <>
      <p data-testid="query">{JSON.stringify(query)}</p>
      <p data-testid="address">{search}</p>
      <button
        onClick={() => {
          setQuery({
            ...query,
            page: 2,
            search: "cable",
            filters: { brand: "Acme" },
            sort: { columnId: "no", direction: "desc" },
          });
        }}
      >
        Change
      </button>
    </>
  );
}

describe("useUrlQuery", () => {
  it("keeps the view in the address and brings it back on a reload", async () => {
    const first = render(
      <MemoryRouter initialEntries={["/list?tab=a"]}>
        <Probe />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    const address = screen.getByTestId("address").textContent;
    expect(new URLSearchParams(address).get("tab")).toBe("a");
    const view = screen.getByTestId("query").textContent;
    first.unmount();

    render(
      <MemoryRouter initialEntries={[`/list${address}`]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("query").textContent).toBe(view);
    expect(JSON.parse(view)).toMatchObject({
      page: 2,
      pageSize: 25,
      search: "cable",
      filters: { brand: "Acme" },
      sort: { columnId: "no", direction: "desc" },
    });
  });

  it("holds a hand-edited page size to the default", () => {
    render(
      <MemoryRouter initialEntries={["/list?pageSize=500&page=x"]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(JSON.parse(screen.getByTestId("query").textContent)).toMatchObject({
      page: 1,
      pageSize: 25,
    });
  });
});
