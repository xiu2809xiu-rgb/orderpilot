// What a list's search box looks in. The rule is here, in one place, so that a
// column a person can see on a list is a column the search can find.
import type {
  MasterDataCustomer,
  MasterDataItem,
} from "./master-data-reader.js";

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** "India" from "IN", or the code itself when the runtime does not know it. */
export function countryNameOf(code: string): string {
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    // DisplayNames throws on a code that is not a region code at all.
    return code;
  }
}

/** What a search is looked for in: text it may be part of, and codes it must equal. */
export interface SearchFields {
  readonly text: readonly string[];
  /** Two-letter codes: "in" is inside half the names, so a code is only found whole. */
  readonly codes?: readonly string[];
}

/** Whether the search is part of the text or is one of the codes, ignoring case. */
export function matches(
  search: string | undefined,
  fields: SearchFields,
): boolean {
  const wanted = search?.trim().toLowerCase();
  if (!wanted) return true;
  return (
    fields.text.join(" ").toLowerCase().includes(wanted) ||
    (fields.codes ?? []).some((code) => code.toLowerCase() === wanted)
  );
}

/**
 * An item is found by its number, description and part number, and by its
 * vendor's number and name and the vendor's own number for it, because Vendor
 * is a column on the list.
 */
export function itemSearchFields(
  item: MasterDataItem,
  vendorName: string,
): SearchFields {
  return {
    text: [
      item.no,
      item.description,
      item.partNumber,
      item.vendorNo,
      vendorName,
      item.vendorItemNo,
    ],
  };
}

/**
 * A customer is found by number and name, and by its country's name or code,
 * because Country is a column and a filter on the list.
 */
export function customerSearchFields(
  customer: MasterDataCustomer,
): SearchFields {
  return {
    text: [
      customer.no,
      customer.name,
      countryNameOf(customer.countryRegionCode),
    ],
    codes: [customer.countryRegionCode],
  };
}

/** A vendor is found by number and name. */
export function vendorSearchFields(vendor: {
  no: string;
  name: string;
}): SearchFields {
  return { text: [vendor.no, vendor.name] };
}
