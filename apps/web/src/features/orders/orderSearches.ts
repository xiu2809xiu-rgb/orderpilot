import type { CustomerRow, ItemRow } from "@orderpilot/shared";
import type { ItemOption, ItemSearch } from "@/components/lines-grid";
import type { LookupOption, LookupSearch } from "@/components/form";
import {
  masterDataCustomers,
  masterDataItems,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import { useSessionStore } from "@/stores/session";
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

/** Each kept list registers a function that forgets its own copy. */
const forgetters: (() => void)[] = [];

/**
 * Forgets the lists kept for the possible matches. The kept copy outlives a
 * query-client reset, so a change of role, which resets the client, calls this
 * too, and the next search asks the server as the new role.
 */
export function forgetKeptLists(): void {
  for (const forget of forgetters) forget();
}

/** Who a kept copy was read for: a sign-out and a new sign-in change it. */
function viewerNow(): string | null {
  return useSessionStore.getState().session?.user.id ?? null;
}

interface Page<Row> {
  data: readonly Row[];
  meta: { total: number };
}

interface Copy<Kept> {
  at: number;
  viewer: string | null;
  rows: readonly Kept[];
}

/** A kept copy is used for the viewer it was read for, while it is fresh. */
function isUsable<Kept>(
  copy: Copy<Kept> | null,
  viewer: string | null,
): copy is Copy<Kept> {
  return (
    copy !== null && copy.viewer === viewer && Date.now() - copy.at < KEEP_MS
  );
}

/**
 * Every record of a list, a page at a time, bounded, reduced by `keep` to what
 * the possible-match list needs. Only the reduced rows are kept, so a field the
 * server masks by role (a price) is never held for the next role. Not kept
 * when aborted, and not kept past a sign-out or a new sign-in.
 */
function wholeList<Row, Kept>(
  fetchPage: (page: number, signal: AbortSignal) => Promise<Page<Row>>,
  keep: (row: Row) => Kept,
): (signal: AbortSignal) => Promise<readonly Kept[]> {
  let kept: Copy<Kept> | null = null;
  forgetters.push(() => {
    kept = null;
  });
  return async (signal) => {
    const viewer = viewerNow();
    if (isUsable(kept, viewer)) return kept.rows;
    const rows: Kept[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const answer = await fetchPage(page, signal);
      rows.push(...answer.data.map(keep));
      if (rows.length >= answer.meta.total || answer.data.length === 0) break;
    }
    kept = { at: Date.now(), viewer, rows };
    return rows;
  };
}

const everyCustomer = wholeList(
  async (page, signal) => masterDataCustomers({ page, pageSize: PAGE }, signal),
  customerOption,
);
const everyItem = wholeList(
  async (page, signal) => masterDataItems({ page, pageSize: PAGE }, signal),
  possibleItemOption,
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
  return withPossible(query, data.map(customerOption), () =>
    everyCustomer(signal),
  );
};

/**
 * What a possible match needs from an item: its facts, and no price. The list
 * these come from is kept for a minute, and a price is the one field the
 * server masks by role.
 */
function possibleItemOption(item: ItemRow): ItemOption {
  return {
    number: item.no,
    name: item.description,
    detail: item.partNumber,
    description: item.description,
    unit: item.baseUnitOfMeasure,
    availableStock: item.availableStock,
  };
}

function itemOption(item: ItemRow): ItemOption {
  return {
    ...possibleItemOption(item),
    unitPrice: { masked: item.unitPrice.masked, value: item.unitPrice.value },
  };
}

/**
 * Items by number, name or part number. Picking one fills the line with what
 * the API said then: its unit, its stock, its description in a grid that
 * copies it and, in a grid that fills the price, the price if the role may see
 * it. An order's grid takes its price from the PO instead. A close name is
 * offered as a possible match with the same facts but no price.
 */
export const searchItems: ItemSearch = async (query, signal) => {
  const { data } = await masterDataItems(
    { search: query, pageSize: RESULTS },
    signal,
  );
  return withPossible(query, data.map(itemOption), () => everyItem(signal));
};
