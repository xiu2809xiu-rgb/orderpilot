import { useEffect, useState } from "react";
import { useOrdersList } from "@/lib/api/generated/endpoints/orders/orders";
import {
  useMasterDataCustomers,
  useMasterDataItems,
  useMasterDataVendors,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import { queryClient } from "@/lib/query";
import { hasPermission, useSessionStore } from "@/stores/session";
import {
  FETCHED_PER_GROUP,
  MIN_QUERY_LENGTH,
  READ_PERMISSION,
  SEARCH_KINDS,
  bestHits,
  fromCustomers,
  fromItems,
  fromOrders,
  fromVendors,
  type RecordHit,
  type SearchKind,
} from "./paletteRecords";

export const DEBOUNCE_MS = 200;

/** The value as it stood `ms` ago, so a request goes out once typing pauses. */
function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [value]);
  return settled;
}

export interface PaletteRecords {
  hits: Readonly<Record<SearchKind, RecordHit[]>>;
  /** Typing has not paused yet, or a request is out. */
  searching: boolean;
  failed: boolean;
  /** The first error, for its trace id. */
  error: unknown;
  retry: () => void;
}

/**
 * Searches the records the signed-in role may read, in parallel, once the
 * trimmed query is two characters. The generated hooks pass an abort signal,
 * so a request the query has outrun is cancelled. The earlier answer stays
 * until the next one lands, so the list does not flash empty between keys.
 *
 * It passes the shared client itself: the palette is loaded on demand and a
 * test may mount it without a provider.
 */
export function usePaletteRecords(query: string): PaletteRecords {
  const session = useSessionStore((state) => state.session);
  const search = useSettled(query);
  const typed = query.length >= MIN_QUERY_LENGTH;
  const asked = typed && search.length >= MIN_QUERY_LENGTH;
  const may = (kind: SearchKind) =>
    asked && hasPermission(session, READ_PERMISSION[kind]);
  const options = (kind: SearchKind) => ({
    query: {
      enabled: may(kind),
      // A palette that waits three seconds to say it failed is worse than a
      // Retry button the person presses once.
      retry: false,
      placeholderData: <T>(previous: T) => previous,
    },
  });
  const params = { search, pageSize: FETCHED_PER_GROUP };

  const orders = useOrdersList(params, options("order"), queryClient);
  const customers = useMasterDataCustomers(
    params,
    options("customer"),
    queryClient,
  );
  const vendors = useMasterDataVendors(params, options("vendor"), queryClient);
  const items = useMasterDataItems(params, options("item"), queryClient);
  const all = {
    order: orders,
    customer: customers,
    vendor: vendors,
    item: items,
  };

  // What a role may not read, or a query too short to ask, shows nothing: the
  // kept earlier answer must not outlive the query it answered.
  const shown = (kind: SearchKind, rows: RecordHit[] | undefined) =>
    may(kind) && rows ? bestHits(rows, search) : [];
  const hits = {
    order: shown("order", orders.data && fromOrders(orders.data.data)),
    customer: shown(
      "customer",
      customers.data && fromCustomers(customers.data.data),
    ),
    vendor: shown("vendor", vendors.data && fromVendors(vendors.data.data)),
    item: shown("item", items.data && fromItems(items.data.data)),
  };

  const active = SEARCH_KINDS.filter(may);
  const failing = active.filter((kind) => all[kind].isError);
  const [firstFailing] = failing;
  return {
    hits,
    searching:
      typed &&
      (search !== query || active.some((kind) => all[kind].isFetching)),
    failed: firstFailing !== undefined,
    error: firstFailing ? all[firstFailing].error : undefined,
    retry: () => {
      failing.forEach((kind) => void all[kind].refetch());
    },
  };
}
