import { QueryClient } from "@tanstack/react-query";
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
 * loading and asked for again, and what is only kept is dropped. A request
 * sent for the earlier person may still be on its way: it is stopped first, so
 * its answer cannot arrive afterwards.
 */
export async function forgetShown(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  client.removeQueries({ type: "inactive" });
  // Not awaited: the page should open at once, and fill as it loads.
  void client.resetQueries();
}
