import {
  PERSON_AVAILABILITY_LOOKUP_MAX_IDS,
  apiPath,
  availabilityLookupResponseSchema,
  type AvailabilityEntry,
} from "@orderpilot/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "@/lib/api/instance";

/** Ids in groups the route accepts, so a caller never meets its limit. */
function chunks(ids: readonly string[]): string[][] {
  const out: string[][] = [];
  for (let at = 0; at < ids.length; at += PERSON_AVAILABILITY_LOOKUP_MAX_IDS) {
    out.push(ids.slice(at, at + PERSON_AVAILABILITY_LOOKUP_MAX_IDS));
  }
  return out;
}

async function lookup(
  ids: readonly string[],
  signal: AbortSignal,
): Promise<AvailabilityEntry[]> {
  const answers = await Promise.all(
    chunks(ids).map(async (group) => {
      const body = await apiClient.request<unknown>({
        method: "GET",
        url: apiPath(`/availability?ids=${group.join(",")}`),
        signal,
      });
      return availabilityLookupResponseSchema.parse(body).data;
    }),
  );
  return answers.flat();
}

/**
 * Other people's availability by user id, for a screen that shows it (ADR
 * 0070). An unknown or disabled id and a person who is Available all answer
 * Available with no time, so a list should draw a mark only for Focusing and
 * Do not disturb. With `enabled` false, or no ids, nothing is requested.
 */
export function useAvailabilityOf(
  ids: readonly string[],
  { enabled = true }: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: ["availability", "of", ids.join(",")],
    queryFn: ({ signal }) => lookup(ids, signal),
    enabled: enabled && ids.length > 0,
    staleTime: 15_000,
    retry: false,
  });
  const byId = useMemo(
    () =>
      new Map<string, AvailabilityEntry>(
        (query.data ?? []).map((entry) => [entry.userId, entry]),
      ),
    [query.data],
  );
  return {
    byId,
    isPending: query.isPending && query.fetchStatus !== "idle",
    isError: query.isError,
    refetch: query.refetch,
  };
}
