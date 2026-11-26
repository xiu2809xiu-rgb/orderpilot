import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * What went wrong with the differences or the confirmation, in the server's own
 * words where they are meant for a person, with the trace id to quote. It takes
 * focus when it appears, so a keyboard user and a screen reader land on it.
 */
export function RevisionAlert({
  title,
  message,
  issues = [],
  extra,
  traceId,
}: {
  title: string;
  message?: string | undefined;
  issues?: readonly string[];
  /** A sentence after the server's words: what to do next. */
  extra?: string | undefined;
  traceId?: string | undefined;
}) {
  const { t } = useTranslation("orders");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  return (
    <div
      ref={box}
      role="alert"
      tabIndex={-1}
      className="flex items-start gap-s2 rounded-md border border-destructive/30 px-s2 py-s2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <CircleAlert
        className="mt-0.5 size-4 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        {message ? (
          <p className="max-w-[70ch] text-muted-foreground">{message}</p>
        ) : null}
        {issues.length > 0 ? (
          <ul className="max-w-[70ch] list-disc ps-s3 text-muted-foreground">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {extra ? (
          <p className="max-w-[70ch] text-muted-foreground">{extra}</p>
        ) : null}
        {traceId ? (
          <p className="text-xs text-muted-foreground">
            {t("form.revision.trace", { traceId })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
