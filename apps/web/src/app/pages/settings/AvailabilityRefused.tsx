import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/kit/Alert";
import { CopyButton } from "@/components/common/CopyButton";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/errors";

/** A change the server refused: what it said, the trace id to quote, and one way to try again. The value on screen is already back to the earlier one. */
export function AvailabilityRefused({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { t: tComponents } = useTranslation("components");
  const { message, traceId } = describeError(error, tc);
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("account.availability.refusedTitle")}</AlertTitle>
      <AlertDescription>
        <span>{message}</span>
        {traceId ? (
          <span className="flex flex-wrap items-center gap-1">
            <span>{tc("errors.traceId")}</span>
            <code className="font-mono">{traceId}</code>
            <CopyButton value={traceId} what={tc("errors.traceId")} />
          </span>
        ) : null}
      </AlertDescription>
      <AlertAction>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {tComponents("states.retry")}
        </Button>
      </AlertAction>
    </Alert>
  );
}
