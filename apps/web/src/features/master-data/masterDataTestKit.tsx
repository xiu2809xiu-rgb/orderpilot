import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import type {
  MasterDataFilters200,
  MasterDataItem200,
  MasterDataItems200,
} from "@/lib/api/generated/model";
import type { Role } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import CustomerDetailPage from "./CustomerDetailPage";
import CustomersPage from "./CustomersPage";
import ItemDetailPage from "./ItemDetailPage";
import ItemsPage from "./ItemsPage";
import VendorDetailPage from "./VendorDetailPage";
import VendorsPage from "./VendorsPage";

export const shown = (field: string, value: string) => ({
  field,
  classification: "confidential" as const,
  masked: false,
  value,
  reason: null,
});

export const hidden = (
  field: string,
  reason: "price" | "bankDetails" | "role",
) => ({
  field,
  classification: "restricted" as const,
  masked: true,
  value: null,
  reason,
});

export const row = (no: string, availability: "short" | "low" | "ok") => ({
  no,
  description: `Synthetic switch ${no}`,
  partNumber: `PN-${no}`,
  brand: "Synthetic Brand",
  category: "NETWORKING" as const,
  baseUnitOfMeasure: "PCS",
  inventory: "120",
  qtyOnSalesOrder: "80",
  qtyOnPurchOrder: "6",
  availableStock: "46",
  availability,
  unitPrice: shown("item.unitPrice", "250.00"),
  vendorNo: "V-0001",
  vendorName: "Synthetic Vendor One",
});

export const itemList = (rows: MasterDataItems200["data"]) => ({
  data: rows,
  meta: { page: 1, pageSize: 25, total: rows.length, mock: true },
});

export const filters: MasterDataFilters200 = {
  data: {
    brands: ["Synthetic Brand"],
    categories: [
      "COMPONENTS",
      "PERIPHERALS",
      "PCS",
      "ENTERPRISE",
      "SECURITY",
      "NETWORKING",
    ],
    vendors: [{ no: "V-0001", name: "Synthetic Vendor One" }],
    countries: ["IN"],
    paymentTerms: ["PREPAID"],
  },
  meta: { mock: true },
};

export const shortItem = {
  data: {
    ...row("I-0004", "short"),
    inventory: "70",
    qtyOnSalesOrder: "30",
    vendorItemNo: "VN-77",
    unitCost: hidden("item.unitCost", "price"),
    orderLines: [
      {
        orderNo: "SO-0012",
        customerNo: "C-0003",
        customerName: "Synthetic Traders",
        orderDate: "2026-10-20",
        shipmentDate: null,
        status: "Waiting for SPR",
        quantity: "146",
        heldOut: true,
        shortfall: {
          state: "waiting" as const,
          ordered: "146",
          availableStock: "46",
          shortBy: "100",
          sprRecordNo: "SPR-0009",
          purchaseOrderNo: null,
          purchaseOrderStatus: null,
        },
      },
      {
        orderNo: "SO-0013",
        customerNo: "C-0004",
        customerName: "Synthetic Systems",
        orderDate: "2026-10-22",
        shipmentDate: null,
        status: "Packing",
        quantity: "30",
        heldOut: false,
        shortfall: null,
      },
    ],
    salesOrderBreakdown: { listed: "30", heldOut: "146" },
    purchaseLines: [],
    sprs: [],
  },
  meta: { mock: true },
} as MasterDataItem200;

export function renderAt(path: string, role: Role = "SUPPORT") {
  useSessionStore.getState().setSession(sessionFor(role));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/master-data/items" element={<ItemsPage />} />
          <Route path="/master-data/customers" element={<CustomersPage />} />
          <Route path="/master-data/vendors" element={<VendorsPage />} />
          <Route path="/master-data/items/:no" element={<ItemDetailPage />} />
          <Route
            path="/master-data/vendors/:no"
            element={<VendorDetailPage />}
          />
          <Route
            path="/master-data/customers/:no"
            element={<CustomerDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const load = () =>
  i18n.loadNamespaces(["master-data", "common", "components", "list-page"]);
