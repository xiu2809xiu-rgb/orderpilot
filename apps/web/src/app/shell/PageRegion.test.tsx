import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, useEffect, useRef } from "react";
import { Link, RouterProvider, createMemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { PageRegion } from "./PageRegion";
import { usePageArrival } from "./usePageArrival";

// What a page does on its own: it counts how many times it was mounted, so the
// tests can tell a page that stood still from one that was drawn again.
const mounts = { home: 0, orders: 0, order: 0 };
function Page({
  name,
  heading,
}: {
  name: keyof typeof mounts;
  heading: string;
}) {
  useEffect(() => {
    mounts[name] += 1;
  }, [name]);
  return (
    <>
      <h1>{heading}</h1>
      <Link to="/orders?view=held">Held</Link>
      <Link to="/orders/SO-1">Open SO-1</Link>
      <Link to="/orders">Orders</Link>
    </>
  );
}

function Frame() {
  const main = useRef<HTMLElement>(null);
  const announcement = usePageArrival(main);
  return (
    <>
      <button type="button">Panel control</button>
      <main ref={main} id="main" tabIndex={-1}>
        <PageRegion />
      </main>
      <p data-testid="said">{announcement}</p>
    </>
  );
}

// A page whose code is still loading when the route opens.
let release: () => void = () => undefined;
const Slow = lazy(
  () =>
    new Promise<{ default: () => React.JSX.Element }>((resolve) => {
      release = () => {
        resolve({ default: () => <h1>Slow page</h1> });
      };
    }),
);

function open(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Frame />,
        children: [
          { path: "/", element: <Page name="home" heading="Good morning" /> },
          {
            path: "/orders",
            element: <Page name="orders" heading="Orders" />,
          },
          {
            path: "/orders/:no",
            element: <Page name="order" heading="SO-1" />,
          },
          {
            path: "/slow",
            element: <Slow />,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("the page region", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["common"]);
  });

  it("keeps a page where it is when only the query string changes", async () => {
    mounts.orders = 0;
    const router = open("/orders");
    await screen.findByRole("heading", { name: "Orders" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Held" }));
    await waitFor(() => {
      expect(router.state.location.search).toBe("?view=held");
    });
    expect(mounts.orders).toBe(1);
  });

  it("draws a new page when the path changes", async () => {
    mounts.order = 0;
    open("/orders");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Open SO-1" }));
    await screen.findByRole("heading", { name: "SO-1" });
    expect(mounts.order).toBe(1);
  });

  it("puts the keyboard at the page, not on a control that is gone", async () => {
    open("/orders");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Open SO-1" }));
    await screen.findByRole("heading", { name: "SO-1" });
    await waitFor(() => {
      expect(document.getElementById("main")).toHaveFocus();
    });
  });

  it("does not take the focus the first page already has", async () => {
    open("/orders");
    await screen.findByRole("heading", { name: "Orders" });
    expect(document.getElementById("main")).not.toHaveFocus();
  });

  it("names the new page in the title and says it aloud", async () => {
    open("/orders");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Open SO-1" }));
    await waitFor(() => {
      expect(screen.getByTestId("said")).toHaveTextContent("SO-1");
    });
    expect(document.title).toBe("SO-1 - OrderPilot");
  });

  it("names the home page Home, not its greeting", async () => {
    open("/");
    await waitFor(() => {
      expect(document.title).toBe("Home - OrderPilot");
    });
  });

  it("shows the shape of the page, and not the page, while its code loads", async () => {
    const router = open("/");
    await screen.findByRole("heading", { name: "Good morning" });
    await act(async () => {
      await router.navigate("/slow");
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("heading", { name: "Slow page" })).toBeNull();
    act(() => {
      release();
    });
    await screen.findByRole("heading", { name: "Slow page" });
  });
});
