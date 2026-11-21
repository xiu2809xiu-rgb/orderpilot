import { render } from "@testing-library/react";
import i18n from "i18next";
import { HttpResponse, http } from "msw";
import { MemoryRouter, useLocation } from "react-router";
import { allFeatures } from "@/features/registry";
import { queryClient } from "@/lib/query";
import { useRecordTabs } from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { CommandPalette } from "./CommandPalette";

export async function loadPaletteWords(): Promise<void> {
  await i18n.loadNamespaces(
    allFeatures
      .map((feature) => feature.namespace)
      .concat("common", "record-tabs"),
  );
}

export function resetPalette(): void {
  useSessionStore.setState({ status: "booting", session: null });
  useRecordTabs.setState({ owner: null, tabs: [] });
  queryClient.clear();
}

const price = {
  field: "item.unitPrice",
  classification: "confidential" as const,
  masked: false,
  value: "100.00",
  reason: null,
};

export const orderRow = (
  orderNo: string,
  customerName: string,
  po: string,
  status = "Short on stock",
) => ({
  orderNo,
  source: "sample" as const,
  captureState: null,
  customerNo: "C-1042",
  customerName,
  externalDocumentNo: po,
  orderDate: "2026-11-14",
  shipmentDate: null,
  workflowStatus: status,
  amount: price,
  currencyCode: "USD",
  shortage: null,
  shortageCount: 0,
});

export const customerRow = (no: string, name: string) => ({
  no,
  name,
  countryRegionCode: "IN",
  currencyCode: "USD",
  paymentTermsCode: "30 DAYS",
  openOrders: 1,
  overdueOrders: 0,
});

export const vendorRow = (no: string, name: string) => ({
  no,
  name,
  currencyCode: "USD",
  paymentTermsCode: "30 DAYS",
  openPurchaseOrders: 0,
  itemsSupplied: 3,
  balanceLcy: { ...price, field: "vendor.balanceLcy" },
});

export const itemRow = (no: string, description: string) => ({
  no,
  description,
  partNumber: `PN-${no}`,
  brand: "Synthetic Brand",
  category: "PERIPHERALS" as const,
  baseUnitOfMeasure: "PCS",
  inventory: "10",
  qtyOnSalesOrder: "0",
  qtyOnPurchOrder: "0",
  availableStock: "10.00",
  availability: "ok" as const,
  unitPrice: price,
  vendorNo: "V-0001",
  vendorName: "Synthetic Vendor",
});

type Kind = "orders" | "customers" | "vendors" | "items";
const PATHS: Record<Kind, string> = {
  orders: "*/api/v1/orders",
  customers: "*/api/v1/master-data/customers",
  vendors: "*/api/v1/master-data/vendors",
  items: "*/api/v1/master-data/items",
};

export interface Served {
  /** The query string of each request, per list. */
  calls: Record<Kind, string[]>;
  /** The lists named here answer 500 until deleted from the set. */
  failing: Set<Kind>;
}

/** Fake lists: each answers what it was given, whatever was searched, and keeps the requests it saw. */
export function serve(rows: Partial<Record<Kind, unknown[]>>): Served {
  const served: Served = {
    calls: { orders: [], customers: [], vendors: [], items: [] },
    failing: new Set(),
  };
  server.use(
    ...(Object.keys(PATHS) as Kind[]).map((kind) =>
      http.get(PATHS[kind], ({ request }) => {
        served.calls[kind].push(new URL(request.url).search);
        if (served.failing.has(kind)) {
          return HttpResponse.json(
            errorBody("INTERNAL_ERROR", "trace-search-1"),
            {
              status: 500,
            },
          );
        }
        const data = rows[kind] ?? [];
        return HttpResponse.json({
          data,
          meta: { page: 1, pageSize: 10, total: data.length },
        });
      }),
    ),
  );
  return served;
}

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

export function openPalette(
  role: Parameters<typeof sessionFor>[0] = "SUPPORT",
) {
  useSessionStore.getState().setSession(sessionFor(role));
  return render(
    <MemoryRouter>
      <CommandPalette open onOpenChange={() => undefined} />
      <Where />
    </MemoryRouter>,
  );
}
