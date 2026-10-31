import type { TableStatus } from "@/components/common";
import { ApiError } from "./api/errors";

/** True when the API refused the signed-in role (403). A screen then shows "permission denied". */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.code === "FORBIDDEN";
}

/** The data table's status for a query: loading, ready, forbidden or error. */
export function tableStatusOf(query: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
}): TableStatus {
  if (query.isPending) return "loading";
  if (query.isError) return isForbidden(query.error) ? "forbidden" : "error";
  return "ready";
}
