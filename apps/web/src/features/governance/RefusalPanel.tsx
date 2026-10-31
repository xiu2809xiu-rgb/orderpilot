import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CopyButton, ErrorPanel, StatePanel } from "@/components/common";
import { ApiError, traceIdOf } from "@/lib/api/errors";

/**
 * How a refused action reads on screen: a plain sentence and the trace id to
 * quote, never the rule that refused (that goes to the audit log). Any other
 * failure falls back to the common error panel.
 */
export function RefusalPanel({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  if (!(error instanceof ApiError) || error.code !== "FORBIDDEN") {
    return <ErrorPanel error={error} onRetry={onRetry} />;
  }
  const traceId = traceIdOf(error);
  return (
    <div role="alert">
      <StatePanel
        variant="inline"
        icon={ShieldAlert}
        title={t("refusals.exampleTitle")}
        description={t("refusals.exampleDescription")}
        traceLabel={traceId ? tc("errors.traceId") : undefined}
        traceId={traceId}
        traceAction={
          traceId ? (
            <CopyButton value={traceId} what={tc("errors.traceId")} />
          ) : null
        }
      />
    </div>
  );
}
