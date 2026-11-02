import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/common/CopyButton";
import { readFormError } from "./serverErrors";

/** The form-level error at the top: what no field could show, with its trace id. */
export function FormErrorSummary() {
  const { t } = useTranslation();
  const { errors } = useFormState();
  const error = readFormError(errors);
  const box = useRef<HTMLDivElement>(null);
  const takeFocus = error?.takeFocus ?? false;

  useEffect(() => {
    if (takeFocus) box.current?.focus();
  }, [takeFocus, error?.traceId, error?.message]);

  if (!error) return null;
  return (
    <div
      ref={box}
      role="alert"
      tabIndex={-1}
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-s2 py-s1 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <CircleAlert
        className="mt-0.5 size-4 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <p className="max-w-[70ch]">{error.message}</p>
        {error.issues.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-xs">
            {error.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {error.traceId ? (
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {t("errors.traceId")}:{" "}
            <code className="font-mono break-all">{error.traceId}</code>
            <CopyButton value={error.traceId} what={t("errors.traceId")} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
