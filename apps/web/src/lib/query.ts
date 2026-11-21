import {
  defaultScheduler,
  notifyManager,
  QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "./api/errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // A 4xx answer will not change by asking again.
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status < 500),
      },
    },
  });
}

export const queryClient = createQueryClient();

/**
 * Nothing the earlier person at this tab was shown may stay for the next one.
 * Emptying the store alone does not do that for a page that is on screen: a
 * list keeps the query it already holds, so the old person's rows stayed under
 * the new person's name until a reload. So what is on screen is put back to
 * loading and asked for again, and what is only kept is dropped.
 *
 * It is synchronous on purpose: the caller runs it before the session store is
 * given the new person, so the first render that carries the new name finds
 * nothing of the earlier one. Resetting a query stops a request still on its
 * way for the earlier person, so its answer cannot arrive afterwards.
 */
export function forgetShown(client: QueryClient): void {
  client.removeQueries({ type: "inactive" });
  // The cache tells the pages what changed in a later task by default. The new
  // name is drawn as soon as the store holds it, so a page told later would
  // sit under that name with the old figures for a few frames. Told now, the
  // pages and the name change in the same render.
  notifyManager.setScheduler((callback) => {
    callback();
  });
  try {
    // Not awaited: the page should open at once, and fill as it loads.
    void client.resetQueries();
  } finally {
    // The library's own default, not a copy of it, so it cannot drift.
    notifyManager.setScheduler(defaultScheduler);
  }
}
