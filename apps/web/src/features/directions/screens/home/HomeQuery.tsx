import type { ReactNode } from "react";
import { ErrorPanel, PermissionDenied } from "@/components/common";
import { ApiError } from "@/lib/api/errors";

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * The states of one block's request, in the home page's own words: the shape
 * of the content while it loads, the plain error with its trace id and a retry
 * when it fails, and the refusal when the server says the role may not read
 * it. The block's own empty and success states are its children.
 */
export function HomeQuery({
  query,
  loading,
  children,
}: {
  query: QueryLike;
  loading: ReactNode;
  children: ReactNode;
}) {
  if (query.isPending) return loading;
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
