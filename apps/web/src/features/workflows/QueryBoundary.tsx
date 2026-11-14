import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  CopyButton,
  ErrorPanel,
  LoadingState,
  StatePanel,
} from "@/components/common";
import { ApiError } from "@/lib/api/errors";

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** A refusal, with the trace id a person quotes when they ask why. */
function Refused({ traceId }: { traceId: string }) {
  const { t } = useTranslation("components");
  const { t: tc } = useTranslation("common");
  return (
    <StatePanel
      variant="inline"
      icon={Lock}
      title={t("states.deniedTitle")}
      description={t("states.deniedDescription")}
      traceLabel={tc("errors.traceId")}
      traceId={traceId}
      traceAction={<CopyButton value={traceId} what={tc("errors.traceId")} />}
    />
  );
}

/**
 * The loading, error and permission-denied states of a query, so each page
 * writes only its own empty and success states. A refusal shows its trace id,
 * as a failure does, because the audit log files the reason under it.
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
      return <Refused traceId={query.error.traceId} />;
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
