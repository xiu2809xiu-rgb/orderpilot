import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "@/components/common";
import { CrumbProvider } from "@/app/shell/pageCrumb";
import { markSubmittedFocus } from "@/features/directions/screens/order/submittedFocus";
import { loadNamespaces } from "@/features/directions/screens/orders/ordersTestKit";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import OrderRoute from "./OrderRoute";
import { markSubmitReopen } from "./submitReopen";
import {
  answerWrite,
  draftDetail,
  fakeServer,
  http,
  HttpResponse,
  NEW_ORDER_NO,
  refused,
  server,
} from "./orderTestKit";

// The route the app really uses, with the real form in it: after a submit the
// route swaps the form for the order's own page, and the notice there takes
// focus. DraftOrderPage.submit.test.tsx mounts the form alone and cannot show
// that join.

const PATH = `/orders/${NEW_ORDER_NO}`;
const SUBMIT = "*/api/v1/orders/:orderNo/submit";
const NOTICE = "Submitted. No team has a task for it";

beforeAll(async () => {
  await loadNamespaces();
  await i18n.loadNamespaces([
    "orders",
    "common",
    "document-form",
    "form",
    "linesGrid",
    "list-page",
    "components",
  ]);
});

beforeEach(() => {
  // The form keeps an unsent draft here: one test's must not reach the next.
  localStorage.clear();
});

afterEach(() => {
  // The mark is module state: point it at an order no test opens.
  markSubmittedFocus("none");
  markSubmitReopen("none");
});

/** The two lists the order page reads beside the order itself, empty. */
function emptyReads() {
  const page = { data: [], meta: { page: 1, pageSize: 5, total: 0 } };
  server.use(
    http.get("*/api/v1/tracker/orders", () => HttpResponse.json(page)),
    http.get("*/api/v1/workflows/tasks", () => HttpResponse.json(page)),
  );
}

function renderRoute() {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/orders", element: <p>Orders list</p> },
      { path: "/orders/:orderNo", element: <OrderRoute /> },
    ],
    { initialEntries: [PATH] },
  );
  return render(
    <QueryClientProvider client={client}>
      <CrumbProvider>
        <Toaster />
        <Suspense fallback={<p>Loading</p>}>
          <RouterProvider router={router} />
        </Suspense>
      </CrumbProvider>
    </QueryClientProvider>,
  );
}

const submittedDetail = () =>
  draftDetail({ captureState: "submitted", version: 4 });

/** The page with the form drawn and the dialog open. */
async function openDialog() {
  const user = userEvent.setup();
  const kit = fakeServer({ detail: () => draftDetail() });
  emptyReads();
  renderRoute();
  await screen.findByRole("textbox", { name: "Quantity, line 1" });
  await user.click(screen.getByRole("button", { name: "Submit order" }));
  await screen.findByRole("dialog");
  return { user, ...kit };
}

const confirm = () =>
  within(screen.getByRole("dialog")).getByRole("button", {
    name: "Submit order",
  });

const noticeRegion = () => screen.findByRole("region", { name: NOTICE });

describe("submitting on the route the app uses", () => {
  it("ends with the order's own page: no dialog, no Submit order, the notice focused, and the status card saying what a typed-in order's page says", async () => {
    const { user, api, requests } = await openDialog();
    answerWrite("post", SUBMIT, requests.submits, () => {
      api.detail = submittedDetail;
      return HttpResponse.json({ data: submittedDetail() });
    });
    await user.click(confirm());
    await noticeRegion();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: NOTICE })).toHaveFocus();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
    const stage = screen.getByText("Current Stage").closest("dl");
    if (!stage) throw new Error("no status card");
    expect(within(stage).getByText("Not in the order flow")).toBeVisible();
    expect(within(stage).getByText("Nobody")).toBeVisible();
    expect(requests.submits).toEqual([{ version: 3 }]);
  });

  it("gives the page to a 409 that says someone else submitted the order, once the order is read again", async () => {
    const { user, requests, api } = await openDialog();
    answerWrite(
      "post",
      SUBMIT,
      requests.submits,
      refused(
        409,
        "CONFLICT",
        null,
        `Order ${NEW_ORDER_NO} is already submitted.`,
      ),
    );
    await user.click(confirm());
    await within(screen.getByRole("dialog")).findByRole("alert");
    api.detail = submittedDetail;
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reload the order",
      }),
    );
    await noticeRegion();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: NOTICE })).toHaveFocus();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit order" })).toBeNull();
  });

  it("puts focus on the notice after an unknown result when the order turns out to be submitted", async () => {
    const { user, requests, api } = await openDialog();
    answerWrite("post", SUBMIT, requests.submits, () => {
      // The server did submit it, and then the answer was lost.
      api.detail = submittedDetail;
      return refused(
        500,
        "INTERNAL_ERROR",
        null,
        "Something went wrong.",
        "trace-500-7",
      )();
    });
    await user.click(confirm());
    await noticeRegion();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: NOTICE })).toHaveFocus();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
