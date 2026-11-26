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
import "./record.css";

/** Back to the list the record belongs to. */
export function BackToList({ to, label }: { to: string; label: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="rec-back dx-back pointer-coarse:h-11"
    >
      <Link to={to}>
        <ArrowLeft aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}

/** The column a record sits in, the same one the order page has. */
export function RecordSheet({ children }: { children: ReactNode }) {
  return <div className="dx-sheet dx-page rec-sheet">{children}</div>;
}

/** Shaped like a record's page: its header, its facts, then its sections. */
export function RecordSkeleton() {
  const { t } = useTranslation("components");
  return (
    <RecordSheet>
      <div role="status" aria-busy="true" className="contents">
        <span className="sr-only">{t("states.loading")}</span>
        <PageHeaderSkeleton />
        <Skeleton still className="h-24 w-full rounded-xl" aria-hidden="true" />
        <SectionCardSkeleton lines={4} />
        <SectionCardSkeleton lines={4} />
      </div>
    </RecordSheet>
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

/**
 * Every state of a record's page. The record itself is drawn by the page, in
 * its own sheet; a record that is not there, failed or refused is drawn here in
 * the same sheet, with the way back above it as on the order page.
 */
export function RecordState({
  query,
  back,
  notFoundTitle,
  notFoundDescription,
  children,
}: RecordStateProps) {
  if (query.isPending) return <RecordSkeleton />;
  if (query.isError) {
    if (isForbidden(query.error)) {
      return (
        <RecordSheet>
          {back}
          <PermissionDenied />
        </RecordSheet>
      );
    }
    if (query.error instanceof ApiError && query.error.code === "NOT_FOUND") {
      return (
        <RecordSheet>
          {back}
          <StatePanel
            icon={FileQuestion}
            title={notFoundTitle}
            description={notFoundDescription}
          />
        </RecordSheet>
      );
    }
    return (
      <RecordSheet>
        {back}
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      </RecordSheet>
    );
  }
  return children();
}
