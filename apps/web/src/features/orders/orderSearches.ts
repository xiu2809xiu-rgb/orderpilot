import type { ItemSearch } from "@/components/lines-grid";
import type { LookupSearch } from "@/components/form";
import {
  masterDataCustomers,
  masterDataItems,
} from "@/lib/api/generated/endpoints/master-data/master-data";

/** Enough to find a record by typing a few characters, short enough to scan. */
const RESULTS = 10;

/**
 * Customers by number or name. The value picked is the Business Central number: the
 * name is shown beside it and never matched on.
 */
export const searchCustomers: LookupSearch = async (query, signal) => {
  const { data } = await masterDataCustomers(
    { search: query, pageSize: RESULTS },
    signal,
  );
  return data.map((customer) => ({
    number: customer.no,
    name: customer.name,
    detail: customer.countryRegionCode,
  }));
};

/**
 * Items by number, name or part number. Picking one fills the line with what
 * the API said then: its unit, its stock and, if the role may see it, its price.
 */
export const searchItems: ItemSearch = async (query, signal) => {
  const { data } = await masterDataItems(
    { search: query, pageSize: RESULTS },
    signal,
  );
  return data.map((item) => ({
    number: item.no,
    name: item.description,
    detail: item.partNumber,
    description: item.description,
    unit: item.baseUnitOfMeasure,
    availableStock: item.availableStock,
    unitPrice: { masked: item.unitPrice.masked, value: item.unitPrice.value },
  }));
};
