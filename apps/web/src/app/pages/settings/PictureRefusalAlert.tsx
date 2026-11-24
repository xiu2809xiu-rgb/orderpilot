import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/common/CopyButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";
import { describeError } from "@/lib/errors";
import { refusalOf } from "./pictureRefusal";

/**
 * What the server said about a refused picture, in words, with the trace id
 * to quote. A failure with no picture code (the network, a 500) is worded
 * from its error code, as every other error is.
 */
export function PictureRefusalAlert({
  refusal,
  limit,
}: {
  refusal: unknown;
  limit: number;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const code = refusalOf(refusal);
  const { message, traceId } = describeError(refusal, tc);
  return (
    <Alert variant="destructive">
      <AlertTitle>
        {code ? t(`account.picture.refusals.${code}`, { limit }) : message}
      </AlertTitle>
      {traceId ? (
        <AlertDescription>
          <span className="flex flex-wrap items-center gap-s2">
            <span>{tc("errors.traceId")}</span>
            <code data-numeric>{traceId}</code>
            <CopyButton value={traceId} what={tc("errors.traceId")} />
          </span>
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
