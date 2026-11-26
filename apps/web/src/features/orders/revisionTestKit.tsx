// Test-only: the New order form refused for a repeated PO number, and the panel that
// adds the re-sent PO to the order as its next PO version, with the API faked.
import { waitFor, screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { expect } from "vitest";
import type {
  CreateSalesOrderBody,
  PoVersionDifferences,
  SalesOrderDetail,
} from "@orderpilot/shared";
import {
  differences,
  maskedDifferences,
} from "@/features/directions/screens/order/versions/versionsTestKit";
import {
  draftDetail,
  fakeServer,
  http,
  HttpResponse,
  refused,
  server,
} from "./orderTestKit";

export const EXISTING = "SO-20261108-0007";
export const PREVIEW = "*/api/v1/orders/:orderNo/po-versions/preview";
export const CONFIRM = "*/api/v1/orders/:orderNo/po-versions";
const CREATE = "*/api/v1/orders";

/** The order a repeated PO number belongs to: submitted, no team holds it. */
export function submittedOrder(
  over: Partial<SalesOrderDetail> = {},
): SalesOrderDetail {
  return draftDetail({
    orderNo: EXISTING,
    captureState: "submitted",
    orderDate: "2026-11-08",
    shipmentDate: "2026-12-01",
    prepaymentPercent: "30.00",
    version: 4,
    poVersionNo: 1,
    workflowStatus: null,
    ...over,
  });
}

/**
 * What the server would answer for a body: the header fields compared with the
 * stored order's, and the lines of the shared fixture. The header is worked out
 * from the body, so a body that keeps the stored values has none that changed.
 */
export function previewOf(
  body: CreateSalesOrderBody,
  stored = submittedOrder(),
  over: Partial<PoVersionDifferences> = {},
): PoVersionDifferences {
  const base = differences();
  const header = [
    ["orderDate", stored.orderDate, body.orderDate],
    ["shipmentDate", stored.shipmentDate, body.shipmentDate],
    ["prepaymentPercent", stored.prepaymentPercent, body.prepaymentPercent],
    ["currencyCode", "USD", "USD"],
  ] as const;
  return {
    ...base,
    header: header.map(([field, from, to]) => ({
      field,
      from,
      to,
      changed: from !== to,
    })),
    ...over,
  };
}

/** `previewOf` for a role that may not see prices: no price anywhere, a mask in its place. */
export function maskedPreviewOf(
  body: CreateSalesOrderBody,
  stored = submittedOrder(),
): PoVersionDifferences {
  const { pricesCompared, total, lines } = maskedDifferences();
  return { ...previewOf(body, stored), pricesCompared, total, lines };
}

export interface RevisionRequests {
  previews: CreateSalesOrderBody[];
  confirms: unknown[];
  creates: unknown[];
}

export interface RevisionApi {
  stored: SalesOrderDetail;
  /** The status the preview answers with, when it is not 200. */
  previewStatus: number;
  /** What the preview answers instead, when a test needs a particular refusal. */
  previewReply: (() => Response) | null;
  /** The preview and the create wait for these before they answer. */
  previewGate: Promise<void> | null;
  createGate: Promise<void> | null;
  /** A role that sees no prices: the form draws no price column. */
  masked: boolean;
  differences: (body: CreateSalesOrderBody) => PoVersionDifferences;
}

/**
 * The server for these tests: the create is refused as a repeated PO number
 * naming the stored order, the order itself can be read, and the preview and
 * the confirmation answer from `api`, which a test changes between calls.
 */
export function serveRevision(over: Partial<RevisionApi> = {}) {
  const api: RevisionApi = {
    stored: submittedOrder(),
    previewStatus: 200,
    previewReply: null,
    previewGate: null,
    createGate: null,
    masked: false,
    differences: (body) => previewOf(body, api.stored),
    ...over,
  };
  const kit = fakeServer({ detail: () => api.stored, masked: api.masked });
  const requests: RevisionRequests = {
    previews: [],
    confirms: [],
    creates: [],
  };
  const duplicate = refused(
    409,
    "CONFLICT",
    [
      {
        path: "externalDocumentNo",
        message: "This customer already has an order with this PO.",
      },
      { path: "existingOrderNo", message: EXISTING },
    ],
    "That PO number is already an order.",
    "trace-dup-1",
  );
  server.use(
    http.post(CREATE, async ({ request }) => {
      requests.creates.push(await request.json());
      await api.createGate;
      return duplicate();
    }),
    http.post(PREVIEW, async ({ request }) => {
      const body = (await request.json()) as CreateSalesOrderBody;
      requests.previews.push(body);
      await api.previewGate;
      if (api.previewReply) return api.previewReply();
      if (api.previewStatus !== 200) {
        return refused(
          api.previewStatus,
          "INTERNAL_ERROR",
          null,
          "x",
          "trace-preview-1",
        )();
      }
      return HttpResponse.json({ data: api.differences(body) });
    }),
  );
  return { api, requests, orderReads: kit.requests };
}

/** Answers the confirmation, and keeps what was sent. */
export function answerConfirm(
  requests: RevisionRequests,
  reply: () => Response | Promise<Response>,
) {
  server.use(
    http.post(CONFIRM, async ({ request }) => {
      requests.confirms.push(await request.json());
      return reply();
    }),
  );
}

type User = ReturnType<typeof userEvent.setup>;

/** Types the order the way a person does, with the PO number given. */
export async function fillNewOrder(
  user: User,
  po: string,
  quantity = "2",
  /** Null for a role that sees no price: the column is not there to type in. */
  price: string | null = "18.40",
) {
  await user.type(
    await screen.findByRole("combobox", { name: /^Customer$/ }),
    "C-0001",
  );
  await user.click(await screen.findByRole("option", { name: /Quillon/ }));
  await user.type(screen.getByRole("textbox", { name: /PO number/ }), po);
  await user.type(
    await screen.findByRole("combobox", { name: "Item, line 1" }),
    "I-0001{Enter}",
  );
  const field = screen.getByRole("textbox", { name: "Quantity, line 1" });
  await waitFor(() => {
    expect(field).toHaveFocus();
  });
  await user.keyboard(quantity);
  if (price === null) return;
  await user.type(
    screen.getByRole("textbox", { name: /Unit price, line 1/ }),
    price,
  );
}

/** Fills and saves: the create is refused as a repeated PO number. */
export async function saveRefused(
  user: User,
  po = "PO-7731",
  price: string | null = "18.40",
) {
  await fillNewOrder(user, po, "2", price);
  await user.click(screen.getByRole("button", { name: /^Save$/ }));
}

export const offerButton = () =>
  screen.findByRole("button", { name: `This PO revises ${EXISTING}` });

/** Presses the offer and waits for the differences. */
export async function openPanel(user: User) {
  await user.click(await offerButton());
  return screen.findByRole("region", {
    name: `Add this PO as PO version 2 of ${EXISTING}`,
  });
}

export { http, HttpResponse, server };
