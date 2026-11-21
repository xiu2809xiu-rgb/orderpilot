import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useToastStore } from "@/components/common/toast";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { loadNamespaces, stubApi, taskOn } from "../orders/ordersTestKit";
import { OrderPage } from "./OrderPage";
import { renderWithToasts } from "./orderPageTestKit";

/**
 * The order page's own button and the notices that stand in for a review. The
 * words are Home's words for the same task, from the same keys.
 */
const ORDER = "SO-0001";
const STEPS = `/workflows/orders/${ORDER}`;

const open = (query = "") =>
  renderWithToasts(<OrderPage orderNo={ORDER} />, `/orders/${ORDER}${query}`);

beforeAll(async () => {
  await loadNamespaces();
});

beforeEach(() => {
  localStorage.clear();
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Every address the page links to. */
function hrefs(): string[] {
  return screen
    .queryAllByRole("link")
    .map((anchor) => anchor.getAttribute("href") ?? "");
}

describe("the task that confirms the fields read from a PO", () => {
  const review = { tasks: [taskOn(ORDER, "REVIEW_FIELDS")] };

  it("says no screen confirms a stored document, and offers no Review of the steps page", async () => {
    stubApi(review);
    open();
    expect(
      await screen.findByText(
        "A document of this order waits for a person to confirm its fields. This build has no screen that confirms a stored document.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
    // The steps page has no control for it, so it is not the way to review.
    expect(hrefs()).not.toContain(STEPS);
  });

  it("keeps the task's due time beside the notice, as Home's row shows it", async () => {
    const task = taskOn(ORDER, "REVIEW_FIELDS");
    stubApi({ tasks: [task] });
    const { container } = open();
    await screen.findByText(/This build has no screen that confirms/);
    expect(screen.getByText("Your task")).toBeVisible();
    const due = container.querySelector("time");
    expect(due?.getAttribute("dateTime")).toBe(
      new Date(task.dueAt).toISOString(),
    );
    expect(due).toHaveTextContent(/late/);
  });

  it("points a demo session to the labelled review on a sample", async () => {
    stubApi(review);
    open();
    const sample = await screen.findByRole("link", {
      name: "See the review on a sample",
    });
    expect(sample).toHaveAttribute("href", "/upload");
  });

  it("offers no sample to a session that is not a demo", async () => {
    vi.stubEnv("DEV", false);
    useSessionStore.setState({
      status: "active",
      session: { ...sessionFor("SUPPORT"), demo: false },
    });
    stubApi(review);
    open();
    await screen.findByText(/This build has no screen that confirms/);
    expect(
      screen.queryByRole("link", { name: "See the review on a sample" }),
    ).toBeNull();
  });

  it("says the same on the Documents tab, and does not send the person to the steps page for it", async () => {
    stubApi({ ...review, toConfirm: [ORDER] });
    open("?tab=documents");
    const banner = (
      await screen.findByText(
        "A document of this order waits for a person to confirm its fields",
      )
    ).closest("[role='alert'], [data-slot='alert']");
    if (!(banner instanceof HTMLElement)) throw new Error("No banner");
    expect(
      within(banner).getByText(/This build has no screen that confirms/),
    ).toBeVisible();
    expect(hrefs()).not.toContain(STEPS);
    expect(screen.queryByRole("link", { name: /steps/i })).toBeNull();
    expect(
      within(banner).getByRole("link", { name: "See the review on a sample" }),
    ).toHaveAttribute("href", "/upload");
  });
});

describe("the Documents tab banner outside a demo session", () => {
  it("offers no sample review, and still sends no one to the steps page", async () => {
    vi.stubEnv("DEV", false);
    useSessionStore.setState({
      status: "active",
      session: { ...sessionFor("SUPPORT"), demo: false },
    });
    stubApi({ toConfirm: [ORDER] });
    open("?tab=documents");
    await screen.findByText(
      "A document of this order waits for a person to confirm its fields",
    );
    expect(
      screen.queryByRole("link", { name: "See the review on a sample" }),
    ).toBeNull();
    expect(hrefs()).not.toContain(STEPS);
  });
});

describe("the sample review for a role that may not upload", () => {
  // /upload tells such a role to sign in as Support, so the link is not
  // offered to it: the same test as the other entries to /upload.
  it("says the words on the Documents tab to a demo session as Warehouse, with no link", async () => {
    useSessionStore.setState({
      status: "active",
      session: { ...sessionFor("WAREHOUSE"), demo: true },
    });
    stubApi({ toConfirm: [ORDER] });
    open("?tab=documents");
    expect(
      await screen.findByText(
        "A document of this order waits for a person to confirm its fields",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "See the review on a sample" }),
    ).toBeNull();
  });

  it("still offers the link to a demo session as Support on the Documents tab", async () => {
    stubApi({ toConfirm: [ORDER] });
    open("?tab=documents");
    expect(
      await screen.findByRole("link", { name: "See the review on a sample" }),
    ).toHaveAttribute("href", "/upload");
  });
});

describe("the same words as Home for the same task", () => {
  const NOTHING = "Records that this is done. OrderPilot sends nothing.";
  const CASES = [
    ["SEND_PI", "Mark PI as sent", NOTHING],
    ["PACK_ORDER", "Mark as packed", NOTHING],
    ["RECOUNT_CARTONS", "Mark as counted", NOTHING],
    ["ADD_SHIPPING_DOCUMENTS", "Mark documents as added", NOTHING],
    [
      "RAISE_SPR",
      "Raise",
      "Raises the SPR for approval. OrderPilot buys nothing.",
    ],
  ] as const;

  it.each(CASES)(
    "%s is the button %s, with its line that it only records",
    async (kind, name, line) => {
      stubApi({ tasks: [taskOn(ORDER, kind)] });
      open();
      const button = await screen.findByRole("button", { name });
      expect(button).toHaveAccessibleDescription(line);
      // The old short words are gone.
      for (const old of ["Mark sent", "Mark packed", "Mark added"]) {
        expect(screen.queryByRole("button", { name: old })).toBeNull();
      }
    },
  );

  it("opens the form that asks for the amount, the reference and the date for a payment, and says so", async () => {
    stubApi({ tasks: [taskOn(ORDER, "CONFIRM_PAYMENT")] });
    open();
    const link = await screen.findByRole("link", {
      name: "Enter payment details",
    });
    expect(link).toHaveAttribute("href", STEPS);
    expect(link).toHaveAccessibleDescription(
      "Opens the form for the amount, the bank reference and the date.",
    );
    expect(screen.queryByRole("link", { name: "Confirm" })).toBeNull();
  });

  it("sends no request to confirm a payment from the page's button", async () => {
    const user = userEvent.setup();
    const calls = stubApi({ tasks: [taskOn(ORDER, "CONFIRM_PAYMENT")] });
    open();
    await user.click(
      await screen.findByRole("link", { name: "Enter payment details" }),
    );
    expect(calls.some((call) => call.startsWith("POST "))).toBe(false);
  });
});

describe("the toast after an act made on the order's own page", () => {
  /** The order API of the kit, and a task that completes when asked to. */
  function stubWithCompletion(kind: string) {
    stubApi({ tasks: [taskOn(ORDER, kind)] });
    const rest = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.includes("/complete") || url.includes("/undo")) {
          return Promise.resolve(
            new Response(JSON.stringify({ data: {} }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return rest(input, init);
      }),
    );
  }

  it("has Undo, and no Open order for the page the person is on", async () => {
    const user = userEvent.setup();
    useToastStore.setState({ items: [] });
    stubWithCompletion("SEND_PI");
    open();
    await user.click(
      await screen.findByRole("button", { name: "Mark PI as sent" }),
    );
    await waitFor(() => {
      expect(useToastStore.getState().items).toHaveLength(1);
    });
    const toast = useToastStore.getState().items[0];
    expect(toast?.message).toBe("Marked the PI for SO-0001 as sent");
    expect(toast?.undo).toBeTypeOf("function");
    expect(toast?.action).toBeUndefined();
    expect(await screen.findByRole("button", { name: "Undo" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open order" })).toBeNull();
  });
});
