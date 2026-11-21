import type { OrderStep, OrderTimelineEvent } from "@orderpilot/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import { Toaster } from "@/components/common/Toaster";
import { createQueryClient } from "@/lib/query";
import type { timelineOf } from "../orders/ordersTestKit";

/**
 * Renders a page at an address with the toaster inside the router, because a
 * finished task's toast carries a link to the order. The shared kit draws the
 * toaster outside the router, which is enough for a page that never toasts.
 */
export function renderWithToasts(element: ReactElement, path: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** What the workflow's record of an order can hold, as the API sends it. */
export interface FlowBody {
  steps?: unknown[];
  timeline?: unknown[];
  documents?: unknown[];
}

/** The workflow's record of one order, whole: a test fills only what it reads. */
export function flowOf(orderNo: string, body: FlowBody = {}) {
  return {
    data: {
      order: {
        no: orderNo,
        sellToCustomerNo: "C-0001",
        customerName: "Alpha Traders",
        externalDocumentNo: `PO-${orderNo}`,
        orderDate: "2026-11-01",
      },
      steps: body.steps ?? [],
      timeline: body.timeline ?? [],
      payment: {
        prepaymentPercent: "30",
        amountDue: null,
        confirmations: [],
      },
      documents: body.documents ?? [],
    },
    meta: { mock: true },
  };
}

/** A timeline entry as the workflow writes it. */
export function entry(
  id: number,
  at: string,
  kind: OrderTimelineEvent["kind"],
  actor: OrderTimelineEvent["actor"],
  summary: string,
): OrderTimelineEvent {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    at,
    kind,
    actor,
    summary,
  };
}

/** A step of the workflow, as the order's steps page lists it. */
export function step(
  key: string,
  state: "done" | "current" | "upcoming",
): OrderStep {
  return {
    key,
    ownerRole: "SUPPORT",
    state,
    optional: false,
    dueAt: null,
    completedAt: state === "done" ? "2026-11-05T08:00:00.000Z" : null,
    overdue: false,
  };
}

/** What the workflow answers for an order: a record, a refusal, or "not known". */
export type FlowAnswer = ReturnType<typeof flowOf> | "forbidden" | "missing";

/**
 * Lays an answer for the workflow's record of an order over whatever `fetch`
 * stub is in place, so the answer can change between two reads (a task was
 * finished and the workflow now has a new entry). Everything else goes to the
 * stub underneath. Finishing a task is answered here too (with `onComplete`
 * called first), because that is what makes the workflow's record change.
 * Returns the paths asked of the record, in order.
 */
export function stubFlow(
  answer: () => FlowAnswer,
  options: { onComplete?: () => void } = {},
): string[] {
  const asked: string[] = [];
  const inner = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        "http://localhost",
      );
      if (
        init?.method === "POST" &&
        /\/workflows\/tasks\/[^/]+\/complete$/.test(url.pathname)
      ) {
        options.onComplete?.();
        return Promise.resolve(
          new Response(JSON.stringify({ data: {}, meta: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (!/\/workflows\/orders\/[^/]+\/flow$/.test(url.pathname)) {
        return inner(input, init);
      }
      asked.push(url.pathname);
      const now = answer();
      const refusal = now === "forbidden" ? "FORBIDDEN" : "NOT_FOUND";
      return Promise.resolve(
        typeof now === "string"
          ? new Response(
              JSON.stringify({
                error: {
                  code: refusal,
                  message: "x",
                  details: null,
                  traceId: "trace-flow",
                },
              }),
              {
                status: now === "forbidden" ? 403 : 404,
                headers: { "Content-Type": "application/json" },
              },
            )
          : new Response(JSON.stringify(now), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
      );
    }),
  );
  return asked;
}

/** The tracker's answer for one order, as the orders kit writes it. */
export type TrackerTimeline = ReturnType<typeof timelineOf>;

/**
 * Lays a change over the tracker's timeline of every order, over whatever
 * `fetch` stub is in place, so a test can give an order the checks it needs
 * (the kit's own timeline has one failed quantity check on every order).
 */
export function stubTimeline(
  change: (timeline: TrackerTimeline) => TrackerTimeline,
): void {
  const inner = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const answer = await inner(input, init);
      const path = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        "http://localhost",
      ).pathname;
      if (!/\/tracker\/orders\/SO-[\w-]+$/.test(path) || !answer.ok) {
        return answer;
      }
      const body = (await answer.json()) as { data: TrackerTimeline };
      return new Response(
        JSON.stringify({ ...body, data: change(body.data) }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
}
