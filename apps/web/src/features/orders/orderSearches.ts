import type { CustomerRow, ItemRow } from "@orderpilot/shared";
import type { ItemOption, ItemSearch } from "@/components/lines-grid";
import type { LookupOption, LookupSearch } from "@/components/form";
import {
  masterDataCustomers,
  masterDataItems,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import { closeNames } from "./closeNames";

/** Enough to find a record by typing a few characters, short enough to scan. */
const RESULTS = 10;
/** Fewer rows than this and the lookup also offers look-alike names. */
const FEW = 3;
/** Below this many characters a guess would match too much by chance. */
const GUESS_FROM = 4;
/** The largest page the API allows, and the most pages read for the guesses. */
const PAGE = 200;
const MAX_PAGES = 5;
/** The guesses are read from a copy of the list kept for a minute. */
const KEEP_MS = 60_000;

interface Page<Row> {
  data: readonly Row[];
  meta: { total: number };
}

/** Every record of a list, a page at a time, bounded. Not kept when aborted. */
function wholeList<Row>(
  fetchPage: (page: number, signal: AbortSignal) => Promise<Page<Row>>,
): (signal: AbortSignal) => Promise<readonly Row[]> {
  let kept: { at: number; rows: readonly Row[] } | null = null;
  return async (signal) => {
    if (kept && Date.now() - kept.at < KEEP_MS) return kept.rows;
    const rows: Row[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const answer = await fetchPage(page, signal);
      rows.push(...answer.data);
      if (rows.length >= answer.meta.total || answer.data.length === 0) break;
    }
    kept = { at: Date.now(), rows };
    return rows;
  };
}

const everyCustomer = wholeList(async (page, signal) =>
  masterDataCustomers({ page, pageSize: PAGE }, signal),
);
const everyItem = wholeList(async (page, signal) =>
  masterDataItems({ page, pageSize: PAGE }, signal),
);

/**
 * When the typed text found fewer than three records, the names that are one
 * or two slips away, marked as possible matches. Matching stays on the
 * number: these are offered, never chosen. A failure to read the whole list
 * leaves the plain answer as it is.
 */
async function withPossible<Found extends LookupOption>(
  query: string,
  found: readonly Found[],
  names: () => Promise<readonly Found[]>,
): Promise<readonly Found[]> {
  if (found.length >= FEW || query.trim().length < GUESS_FROM) return found;
  try {
    const close = closeNames(query, await names(), {
      exclude: new Set(found.map((record) => record.number)),
    });
    return [
      ...found,
      ...close.map((record) => ({ ...record, possible: true })),
    ];
  } catch {
    return found;
  }
}

function customerOption(customer: CustomerRow): LookupOption {
  return {
    number: customer.no,
    name: customer.name,
    detail: customer.countryRegionCode,
  };
}

/**
 * Customers by number or name. The value picked is the Business Central number: the
 * name is shown beside it and never matched on. A name that is close to the
 * typed text, but not the text, is offered as a possible match.
 */
export const searchCustomers: LookupSearch = async (query, signal) => {
  const { data } = await masterDataCustomers(
    { search: query, pageSize: RESULTS },
    signal,
  );
  return withPossible(query, data.map(customerOption), async () =>
    (await everyCustomer(signal)).map(customerOption),
  );
};

function itemOption(item: ItemRow): ItemOption {
  return {
    number: item.no,
    name: item.description,
    detail: item.partNumber,
    description: item.description,
    unit: item.baseUnitOfMeasure,
    availableStock: item.availableStock,
    unitPrice: { masked: item.unitPrice.masked, value: item.unitPrice.value },
  };
}

/**
 * Items by number, name or part number. Picking one fills the line with what
 * the API said then: its unit, its stock and, if the role may see it, its
 * price. A close name is offered as a possible match, with the same facts.
 */
export const searchItems: ItemSearch = async (query, signal) => {
  const { data } = await masterDataItems(
    { search: query, pageSize: RESULTS },
    signal,
  );
  return withPossible(query, data.map(itemOption), async () =>
    (await everyItem(signal)).map(itemOption),
  );
};
