import {
  apiPath,
  governanceNoticeListResponseSchema,
} from "@orderpilot/shared";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/instance";

export const ADMIN_NOTICES_KEY = ["governance-notices"] as const;
const NEXT = 5;

// The bell sits in the entry bundle. The generated governance client would
// pull every governance route in with it, so this asks through the plain API
// client, as the bell's reminders do.
async function fetchNotices(signal: AbortSignal) {
  const body = await apiClient.request<unknown>({
    method: "GET",
    url: apiPath(`/governance/notices?pageSize=${String(NEXT)}`),
    signal,
  });
  return governanceNoticeListResponseSchema.parse(body);
}

/**
 * What the administrator's role gained, newest first, for a person who
 * decides approvals (#383). The server refuses anyone else, so the caller
 * only asks when the session holds approvals.decide.
 */
export function useAdminNotices(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_NOTICES_KEY,
    queryFn: ({ signal }) => fetchNotices(signal),
    enabled,
  });
}

/** Marks one notice read, for the person asking. */
export async function markNoticeRead(id: string): Promise<void> {
  await apiClient.request<unknown>({
    method: "POST",
    url: apiPath(`/governance/notices/${id}/read`),
  });
}
