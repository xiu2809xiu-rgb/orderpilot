import { CircleAlert, Inbox, Lock, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { describeError } from "@/lib/errors";
import { CopyButton } from "./CopyButton";
import { StatePanel } from "./StatePanel";

/** Loading: grey blocks the size of the content, announced once as "Loading". */
export function LoadingState({ lines = 4 }: { lines?: number }) {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{t("states.loading")}</span>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-6 w-full" aria-hidden="true" />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  /** The next step, such as a button to create the first record. Always give one. */
  action?: ReactNode;
}

/** Nothing to show yet, and what to do about it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  const { t } = useTranslation("components");
  return (
    <StatePanel
      variant="inline"
      icon={icon ?? Inbox}
      title={title ?? t("states.emptyTitle")}
      description={description}
    >
      {action}
    </StatePanel>
  );
}

interface ErrorPanelProps {
  /** Any thrown value. The words come from the error code and the trace id is shown. */
  error: unknown;
  onRetry?: () => void;
}

/** A failed load: what happened in plain words, a trace id to quote, and Try again. */
export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const { t } = useTranslation("components");
  const { t: tc } = useTranslation("common");
  const { message, traceId } = describeError(error, tc);
  return (
    <div role="alert">
      <StatePanel
        variant="inline"
        icon={CircleAlert}
        title={t("states.errorTitle")}
        description={message}
        traceLabel={traceId ? tc("errors.traceId") : undefined}
        traceId={traceId}
        traceAction={
          traceId ? (
            <CopyButton value={traceId} what={tc("errors.traceId")} />
          ) : null
        }
      >
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            {t("states.retry")}
          </Button>
        ) : null}
      </StatePanel>
    </div>
  );
}

interface PartialNoticeProps {
  description?: string;
  onRetry?: () => void;
}

/** Some data arrived and some did not. The page stays usable; this says what you see may be incomplete. */
export function PartialNotice({ description, onRetry }: PartialNoticeProps) {
  const { t } = useTranslation("components");
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-s1 rounded-lg bg-warning-surface px-s2 py-s1 text-sm text-warning"
    >
      <p className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-medium">{t("states.partialTitle")}.</strong>{" "}
          {description ?? t("states.partialDescription")}
        </span>
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("states.retry")}
        </Button>
      ) : null}
    </div>
  );
}

/** The signed-in person's role does not include this block. Use ForbiddenPage for a whole route. */
export function PermissionDenied({ description }: { description?: string }) {
  const { t } = useTranslation("components");
  return (
    <StatePanel
      variant="inline"
      icon={Lock}
      title={t("states.deniedTitle")}
      description={description ?? t("states.deniedDescription")}
    />
  );
}
