import type { ReactNode } from "react";
import {
  ErrorPanel,
  LoadingState,
  PermissionDenied,
} from "@/components/common";
import { ApiError } from "@/lib/api/errors";

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * The loading, error and permission-denied states of a query, so each page
 * writes only its own empty and success states.
 */
export function QueryBoundary({
  query,
  children,
}: {
  query: QueryLike;
  children: ReactNode;
}) {
  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 403) {
      return <PermissionDenied />;
    }
    return (
      <ErrorPanel
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return <>{children}</>;
}
