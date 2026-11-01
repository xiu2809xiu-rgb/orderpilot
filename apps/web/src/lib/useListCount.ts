import { apiPath } from "@orderpilot/shared";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "@/lib/api/instance";

const listSchema = z.object({ meta: z.object({ total: z.number() }) });

/** The list's own total, so a count cannot disagree with the page it opens. */
async function countOf(api: string, signal: AbortSignal): Promise<number> {
  const joiner = api.includes("?") ? "&" : "?";
  const body = await apiClient.request<unknown>({
    method: "GET",
    url: apiPath(`${api}${joiner}pageSize=1`),
    signal,
  });
  return listSchema.parse(body).meta.total;
}

/**
 * The total of an API list. A home tile and a menu entry that name the same
 * list share one query key, so they show one number and cost one request.
 * With `enabled` false nothing is requested: pass it when the role may not
 * read the list. It goes through `apiClient`, because the shell holds it and
 * the generated client would join the entry bundle.
 */
export function useListCount(api: string, enabled = true) {
  return useQuery({
    queryKey: ["list-count", api],
    queryFn: ({ signal }) => countOf(api, signal),
    enabled,
  });
}
