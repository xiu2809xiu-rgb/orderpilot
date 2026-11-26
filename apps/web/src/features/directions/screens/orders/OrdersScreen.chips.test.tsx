import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import OrdersScreen from "./OrdersScreen";
import { loadNamespaces, nth, renderAt, stubApi } from "./ordersTestKit";

// The chips of the Orders filters: the status chips that write several
// statuses into the address, the pills that name them, and the small movements
// that answer a press. The movement itself is judged in a browser; what is held
// here is that the states, the words and the focus are the same whatever moves.

const PAYMENT = "sample-awaiting-payment";
const MISMATCH = "sample-packing-list-mismatch";

function Probe() {
  const { pathname, search } = useLocation();
  return <output aria-label="here">{`${pathname}${search}`}</output>;
}

const here = () => screen.getByLabelText("here").textContent;
const statusInAddress = () =>
  new URLSearchParams(here().split("?")[1] ?? "").get("status");

function open(path = "/orders") {
  return renderAt(
    <>
      <Probe />
      <OrdersScreen />
    </>,
    path,
  );
}

/** The table's body rows, once the orders have arrived. */
async function bodyRows(): Promise<HTMLElement[]> {
  await screen.findAllByRole("link", { name: /^SO-[\w-]+$/ });
  return within(nth(screen.getAllByRole("table"), 0))
    .getAllByRole("row")
    .slice(1);
}

/** Opens the Statuses popover and returns its group of chips. */
async function openStatuses(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Statuses/ }));
  return screen.getByRole("group", { name: "Pick the statuses to show" });
}

const pills = () => screen.getByRole("list", { name: "Filters in force" });
const remove = (name: string) =>
  within(pills()).getByRole("button", { name: `Remove filter: ${name}` });

function stubReducedMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeAll(loadNamespaces);

beforeEach(() => {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
  stubApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the status chips", () => {
  it("write the statuses pressed into the address as a comma list, and narrow the list to them", async () => {
    const user = userEvent.setup();
    open();
    await bodyRows();
    const group = await openStatuses(user);
    // Pressed in the other order: the address keeps the lifecycle's own.
    await user.click(
      within(group).getByRole("button", {
        name: "Packing list differs from the PO",
      }),
    );
    await user.click(
      within(group).getByRole("button", { name: "Waiting for payment" }),
    );
    expect(statusInAddress()).toBe(`${PAYMENT},${MISMATCH}`);
    for (const name of [
      "Waiting for payment",
      "Packing list differs from the PO",
    ]) {
      const chip = within(group).getByRole("button", { name });
      expect(chip).toHaveAttribute("aria-pressed", "true");
      // The check stays, in the slot that is always there.
      expect(chip.querySelector(".chip-slot")).toHaveAttribute(
        "data-on",
        "true",
      );
      expect(chip.querySelector(".chip-slot svg.lucide-check")).not.toBeNull();
    }
    const rows = await waitFor(async () => {
      const found = await bodyRows();
      expect(found).toHaveLength(2);
      return found;
    });
    expect(
      rows
        .map((row) => within(row).getAllByRole("link")[0]?.textContent)
        .sort(),
    ).toEqual(["SO-0001", "SO-0003"]);
  });

  it("take a status off when it is pressed again, and no filter is left when the last goes", async () => {
    const user = userEvent.setup();
    open(`/orders?status=${PAYMENT}%2C${MISMATCH}`);
    await bodyRows();
    const group = await openStatuses(user);
    const payment = within(group).getByRole("button", {
      name: "Waiting for payment",
    });
    expect(payment).toHaveAttribute("aria-pressed", "true");
    await user.click(payment);
    expect(payment).toHaveAttribute("aria-pressed", "false");
    expect(payment.querySelector(".chip-slot")).toHaveAttribute(
      "data-on",
      "false",
    );
    expect(statusInAddress()).toBe(MISMATCH);
    await user.click(
      within(group).getByRole("button", {
        name: "Packing list differs from the PO",
      }),
    );
    expect(statusInAddress()).toBeNull();
    expect(screen.queryByRole("list", { name: "Filters in force" })).toBeNull();
  });

  it("are named by the applied pill, in the lifecycle's order, and the count of the button says how many", async () => {
    const user = userEvent.setup();
    open();
    await bodyRows();
    const group = await openStatuses(user);
    await user.click(
      within(group).getByRole("button", { name: "Waiting for payment" }),
    );
    await user.click(
      within(group).getByRole("button", {
        name: "Packing list differs from the PO",
      }),
    );
    expect(
      within(pills()).getByText(
        "Status: Waiting for payment, Packing list differs from the PO",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("2 statuses are on")).toHaveTextContent("2");
  });

  it("name the first three and count the rest when a pill would be too long", async () => {
    open(
      "/orders?status=sample-po-received%2Csample-extracted-awaiting-review%2Csample-short-stock%2Csample-pending-approval%2Csample-pi-to-send",
    );
    await bodyRows();
    expect(
      within(pills()).getByText(
        "Status: PO received, Fields awaiting review, Short on stock and 2 more",
      ),
    ).toBeVisible();
  });

  it("are all off, and the list says several, for a pair of statuses that is not a whole stage", async () => {
    open(`/orders?status=${PAYMENT}%2C${MISMATCH}`);
    await bodyRows();
    expect(
      screen.getByRole("combobox", { name: "Stage and status" }),
    ).toHaveTextContent("Several statuses");
  });
});

describe("the count on the Filters button", () => {
  it("bumps when a filter is added and says the same words as before", async () => {
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.click(screen.getByRole("button", { name: "Past due" }));
    const one = screen.getByLabelText("1 filter is on");
    expect(one).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Has exceptions" }));
    const two = screen.getByLabelText("2 filters are on");
    expect(two).toHaveTextContent("2");
    expect(two).toHaveAttribute("data-bump");
  });

  it("does not bump under reduced motion, with the same number and words", async () => {
    stubReducedMotion();
    const user = userEvent.setup();
    open();
    await bodyRows();
    await user.click(screen.getByRole("button", { name: "Past due" }));
    await user.click(screen.getByRole("button", { name: "Has exceptions" }));
    const two = screen.getByLabelText("2 filters are on");
    expect(two).toHaveTextContent("2");
    expect(two).not.toHaveAttribute("data-bump");
  });
});

describe("the yes or no chips of Orders", () => {
  it("flip aria-pressed when pressed, and keep the check in a slot that is always there", async () => {
    const user = userEvent.setup();
    open();
    await bodyRows();
    const chip = screen.getByRole("button", { name: "Past due" });
    const slot = chip.querySelector(".chip-slot");
    expect(slot).not.toBeNull();
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.querySelector(".chip-slot")).toBe(slot);
    expect(slot).toHaveAttribute("data-on", "true");
    expect(slot?.querySelector("svg.lucide-check")).not.toBeNull();
  });
});

describe("a cleared applied pill", () => {
  const THREE = `/orders?status=sample-closed&overdue=true&exceptionsOnly=true`;
  const ghosts = () => document.querySelectorAll("[data-leaving]");

  it("fades out where it stood, leaves the DOM, and focus goes to the next pill and then to Clear all", async () => {
    const user = userEvent.setup();
    open(THREE);
    await screen.findByRole("list", { name: "Filters in force" });
    await user.click(remove("Past due"));
    // The list is already filtered by the rest; what stays is a picture.
    expect(ghosts()).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Remove filter: Past due" }),
    ).toBeNull();
    expect(remove("Has exceptions")).toHaveFocus();
    endAnimation(must(ghosts()[0]));
    expect(ghosts()).toHaveLength(0);
    await user.click(remove("Has exceptions"));
    expect(screen.getByRole("button", { name: "Clear all" })).toHaveFocus();
  });

  it("goes at once under reduced motion, with focus on the next pill", async () => {
    stubReducedMotion();
    const user = userEvent.setup();
    open(THREE);
    await screen.findByRole("list", { name: "Filters in force" });
    await user.click(remove("Past due"));
    expect(ghosts()).toHaveLength(0);
    expect(remove("Has exceptions")).toHaveFocus();
  });

  it("sends focus up to the filters, not the page top, when Clear all takes the row away", async () => {
    const user = userEvent.setup();
    open(THREE);
    await screen.findByRole("list", { name: "Filters in force" });
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveFocus();
    expect(screen.queryByRole("list", { name: "Filters in force" })).toBeNull();
  });
});

/** See chips.test.tsx: jsdom has no AnimationEvent, so React listens for the prefixed name. */
function endAnimation(element: Element) {
  fireEvent.animationEnd(element);
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));
}

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected a value in the test.");
  return value;
}
