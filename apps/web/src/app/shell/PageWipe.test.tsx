import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Outlet, RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageWipe } from "./PageWipe";

function Frame() {
  return (
    <>
      <nav>
        <Link to="/">Go home</Link>
        <Link to="/orders">Go to orders</Link>
        <Link to="/orders?view=held">Filter held</Link>
        <Link to="/orders/SO-7">Open SO-7</Link>
      </nav>
      <Outlet />
      <PageWipe />
    </>
  );
}

function open(path = "/") {
  const router = createMemoryRouter(
    [
      {
        element: <Frame />,
        children: [
          { path: "/", element: <p>Home page</p>, handle: { crumb: "Home" } },
          {
            path: "/orders",
            element: <p>Orders page</p>,
            handle: { crumb: "Orders" },
          },
          {
            path: "/orders/:no",
            element: <p>Order page</p>,
            handle: { crumb: "Orders", record: { kind: "order", param: "no" } },
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

/** The direction the last glide played in: normal is left to right. */
function lastDirection(): string | undefined {
  const options = animate.mock.calls.at(-1)?.[1] as
    KeyframeAnimationOptions | undefined;
  return options?.direction;
}

function layer(): HTMLElement {
  const found = document.querySelector<HTMLElement>(".dx-wipe");
  if (!found) throw new Error("no wipe layer");
  return found;
}

let animate: ReturnType<typeof vi.fn>;
let reduce = false;

beforeEach(() => {
  reduce = false;
  // jsdom has neither the Web Animations API nor matchMedia.
  animate = vi.fn(() => ({
    finished: new Promise(() => undefined),
    cancel: vi.fn(),
  }));
  Element.prototype.animate = animate as unknown as Element["animate"];
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduce") && reduce,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("the page-change name", () => {
  it("opens the first page without a glide, and hides the name from screen readers", () => {
    open("/");
    expect(screen.getByText("Home page")).toBeInTheDocument();
    expect(animate).not.toHaveBeenCalled();
    expect(layer()).toHaveAttribute("aria-hidden", "true");
    expect(layer()).toHaveAttribute("data-on", "false");
  });

  it("glides the new page's name once when the page changes, left to right", async () => {
    open("/");
    await userEvent.click(screen.getByRole("link", { name: "Go to orders" }));
    // The page has already changed: the glide never holds it back.
    expect(screen.getByText("Orders page")).toBeInTheDocument();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(layer()).toHaveAttribute("data-on", "true");
    expect(lastDirection()).toBe("normal");
    expect(layer()).toHaveTextContent("Orders");
  });

  it("never glides for a filter, a tab or a sort on the same page", async () => {
    open("/orders");
    await userEvent.click(screen.getByRole("link", { name: "Filter held" }));
    expect(animate).not.toHaveBeenCalled();
  });

  it("carries a record's number when a record opens from its list", async () => {
    open("/orders");
    await userEvent.click(screen.getByRole("link", { name: "Open SO-7" }));
    expect(screen.getByText("Order page")).toBeInTheDocument();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(layer()).toHaveTextContent("SO-7");
  });

  it("glides the other way going Home and going Back", async () => {
    const router = open("/orders");
    await userEvent.click(screen.getByRole("link", { name: "Go home" }));
    expect(lastDirection()).toBe("reverse");
    await userEvent.click(screen.getByRole("link", { name: "Go to orders" }));
    await userEvent.click(screen.getByRole("link", { name: "Open SO-7" }));
    expect(lastDirection()).toBe("normal");
    // Back to the orders list, which is not Home: the browser's Back alone turns it.
    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.getByText("Orders page")).toBeInTheDocument();
    expect(lastDirection()).toBe("reverse");
    expect(animate).toHaveBeenCalledTimes(4);
  });

  it("shows no name when the person asks for reduced motion", async () => {
    reduce = true;
    open("/");
    await userEvent.click(screen.getByRole("link", { name: "Go to orders" }));
    expect(screen.getByText("Orders page")).toBeInTheDocument();
    expect(animate).not.toHaveBeenCalled();
    expect(layer()).toHaveAttribute("data-on", "false");
  });
});
