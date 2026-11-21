import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";

export interface Failure {
  message: string;
  traceId: string | undefined;
}

/** Why a sign-in failed, and the trace ID to quote when it was not the person's doing. */
export function SignInFailure({ failure }: { failure: Failure }) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <AlertTitle>{failure.message}</AlertTitle>
      {failure.traceId ? (
        <AlertDescription>
          <p>
            {t("errors.traceId")}:{" "}
            <code className="font-mono">{failure.traceId}</code>
          </p>
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
