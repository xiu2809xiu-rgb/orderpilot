// Test-only: the Versions tab and the differences, with the API faked at the network.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import type {
  PoVersionDetail,
  PoVersionDifferences,
  PoVersionSummary,
  Role,
  SalesOrderDetail,
} from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { VersionsTab } from "./VersionsTab";

export const ORDER = "SO-20261109-0001";

const SHOWN = {
  field: "item.unitPrice",
  classification: "confidential" as const,
  masked: false,
  reason: null,
};
/** A submitted order at a PO version, in the shape the API answers with. */
export function submittedDetail(
  over: Partial<SalesOrderDetail> = {},
): SalesOrderDetail {
  return {
    orderNo: ORDER,
    source: "stored",
    captureState: "submitted",
    customerNo: "C-0001",
    customerName: "Quillon Harbour Traders",
    externalDocumentNo: "PO-7731",
    orderDate: "2026-11-09",
    shipmentDate: null,
    workflowStatus: null,
    amount: { ...SHOWN, value: "125.00" },
    currencyCode: "USD",
    shortage: null,
    shortageCount: 0,
    prepaymentPercent: "100.00",
    navisionNo: null,
    version: 4,
    poVersionNo: 2,
    lines: [],
    ...over,
  };
}

/** One row of the list, newest first as the API sends them. */
export function versionRow(
  poVersionNo: number,
  current: boolean,
  over: Partial<PoVersionSummary> = {},
): PoVersionSummary {
  return {
    poVersionNo,
    current,
    arrivedAt: "2026-11-09T02:00:00.000Z",
    arrivedBy: poVersionNo === 1 ? "Sara Tan" : "Dev Menon",
    supersededAt: current ? null : "2026-11-10T03:30:00.000Z",
    supersededBy: current ? null : "Dev Menon",
    lineCount: 2,
    total: { ...SHOWN, value: "125.00" },
    ...over,
  };
}

/** The differences between two versions: quantity 2 to 5 on one line, an added line and a moved one. */
export function differences(
  over: Partial<PoVersionDifferences> = {},
): PoVersionDifferences {
  const same = { from: "4.000", to: "4.000", changed: false };
  const price = (from: string, to: string) => ({
    masked: false as const,
    from,
    to,
    changed: from !== to,
  });
  return {
    fromPoVersionNo: 1,
    toPoVersionNo: 2,
    identical: false,
    pricesCompared: true,
    header: [
      {
        field: "orderDate",
        from: "2026-11-09",
        to: "2026-11-12",
        changed: true,
      },
      { field: "shipmentDate", from: null, to: null, changed: false },
      {
        field: "prepaymentPercent",
        from: "30.00",
        to: "100.00",
        changed: true,
      },
      { field: "currencyCode", from: "USD", to: "USD", changed: false },
    ],
    total: price("100.00", "125.00"),
    lines: [
      {
        status: "changed",
        itemNo: "I-0001",
        description: "Norvale Wireless Mouse",
        fromLineNo: 1,
        toLineNo: 1,
        moved: false,
        quantity: { from: "2.000", to: "5.000", changed: true },
        unitPrice: price("18.40", "18.40"),
      },
      {
        status: "added",
        itemNo: "I-0003",
        description: "Norvale Keyboard",
        fromLineNo: null,
        toLineNo: 2,
        moved: false,
        quantity: { from: null, to: "1.000", changed: true },
        unitPrice: price("0.00", "32.50"),
      },
      {
        status: "unchanged",
        itemNo: "I-0002",
        description: "Norvale Dock",
        fromLineNo: 2,
        toLineNo: 3,
        moved: true,
        quantity: same,
        unitPrice: price("9.00", "9.00"),
      },
      {
        status: "unchanged",
        itemNo: "I-0004",
        description: "Norvale Cable",
        fromLineNo: 3,
        toLineNo: 4,
        moved: false,
        quantity: same,
        unitPrice: price("1.00", "1.00"),
      },
    ],
    counts: { added: 1, removed: 0, changed: 1, moved: 1, unchanged: 2 },
    ...over,
  };
}

/** The same differences for a role that may not see prices: no price anywhere, a mask in its place. */
export function maskedDifferences(): PoVersionDifferences {
  const base = differences();
  const mask = {
    masked: true as const,
    field: "item.unitPrice",
    classification: "restricted" as const,
    reason: "price" as const,
  };
  return {
    ...base,
    pricesCompared: false,
    total: mask,
    lines: base.lines.map((line) => ({ ...line, unitPrice: mask })),
  };
}

/** One version with its lines, as the API sends it for a role that sees prices. */
export function versionDetail(
  poVersionNo: number,
  over: Partial<PoVersionDetail> = {},
): PoVersionDetail {
  return {
    ...versionRow(poVersionNo, false),
    orderDate: "2026-11-09",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "30.00",
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Norvale Wireless Mouse",
        quantity: "2.000",
        qtyToShip: "2.000",
        unitPrice: { ...SHOWN, value: "18.40" },
        lineAmount: { ...SHOWN, value: "36.80" },
      },
    ],
    ...over,
  };
}

export interface VersionsApi {
  detail: SalesOrderDetail;
  versions: PoVersionSummary[];
  diff: PoVersionDifferences;
  /** The status of each read, when it is not 200. */
  listStatus?: number;
  diffStatus?: number;
  oneStatus?: number;
  one?: (poVersionNo: number) => PoVersionDetail;
}

export interface VersionsRequests {
  order: number;
  list: number;
  diffs: string[];
  ones: number[];
}

/** Handlers for what the tab reads, and a record of what it asked. */
export function serveVersions(api: VersionsApi): VersionsRequests {
  const requests: VersionsRequests = { order: 0, list: 0, diffs: [], ones: [] };
  const failed = (status: number) =>
    HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-versions-1"), {
      status,
    });
  server.use(
    http.get("*/api/v1/orders/:orderNo", () => {
      requests.order += 1;
      return HttpResponse.json({ data: api.detail });
    }),
    http.get("*/api/v1/orders/:orderNo/po-versions", () => {
      requests.list += 1;
      if (api.listStatus) return failed(api.listStatus);
      return HttpResponse.json({
        data: {
          orderNo: ORDER,
          currentPoVersionNo: api.versions[0]?.poVersionNo ?? 1,
          versions: api.versions,
        },
      });
    }),
    http.get("*/api/v1/orders/:orderNo/po-versions/diff", ({ request }) => {
      const { search } = new URL(request.url);
      requests.diffs.push(search);
      if (api.diffStatus) return failed(api.diffStatus);
      return HttpResponse.json({ data: api.diff });
    }),
    http.get("*/api/v1/orders/:orderNo/po-versions/:no", ({ params }) => {
      const n = Number(params.no);
      requests.ones.push(n);
      if (api.oneStatus) return failed(api.oneStatus);
      return HttpResponse.json({
        data: (api.one ?? ((v) => versionDetail(v)))(n),
      });
    }),
  );
  return requests;
}

/** The Versions tab at its address, signed in as `role`. */
export function renderVersions(role: Role = "SUPPORT", orderNo = ORDER) {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/orders/${orderNo}?tab=versions`]}>
        <VersionsTab orderNo={orderNo} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
