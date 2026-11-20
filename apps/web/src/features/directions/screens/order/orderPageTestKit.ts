import { vi } from "vitest";

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
  kind: string,
  actor: { kind: "user" | "system"; name: string },
  summary: string,
) {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    at,
    kind,
    actor,
    summary,
  };
}

/** A step of the workflow, as the order's steps page lists it. */
export function step(key: string, state: "done" | "current" | "upcoming") {
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
 * stub underneath. Returns the paths asked of the record, in order.
 */
export function stubFlow(answer: () => FlowAnswer): string[] {
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
