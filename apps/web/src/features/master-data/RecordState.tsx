import { ArrowLeft, FileQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  ErrorPanel,
  PageHeaderSkeleton,
  PermissionDenied,
  SectionCardSkeleton,
  StatePanel,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { isForbidden } from "@/lib/query-status";

/** Back to the list the record belongs to. */
export function BackToList({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to={to}>
        <ArrowLeft aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}

/** Shaped like a record's page: its header, its facts, then its sections. */
export function RecordSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="space-y-s3">
      <span className="sr-only">{t("states.loading")}</span>
      <PageHeaderSkeleton />
      <Skeleton
        className="h-24 w-full animate-none rounded-xl"
        aria-hidden="true"
      />
      <SectionCardSkeleton lines={4} />
      <SectionCardSkeleton lines={4} />
    </div>
  );
}

interface RecordStateProps {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  /** The list to go back to, shown when the number is unknown. */
  back: ReactNode;
  notFoundTitle: string;
  notFoundDescription: string;
  children: () => ReactNode;
}

/** Every state of a record's page but the record itself. */
export function RecordState({
  query,
  back,
  notFoundTitle,
  notFoundDescription,
  children,
}: RecordStateProps) {
  if (query.isPending) return <RecordSkeleton />;
  if (query.isError) {
    if (isForbidden(query.error)) return <PermissionDenied />;
    if (query.error instanceof ApiError && query.error.code === "NOT_FOUND") {
      return (
        <StatePanel
          icon={FileQuestion}
          title={notFoundTitle}
          description={notFoundDescription}
        >
          {back}
        </StatePanel>
      );
    }
    return (
      <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  return children();
}
