import { useTranslation } from "react-i18next";
import { RevisionAlert } from "./RevisionAlert";
import type { RevisionFailure } from "./revisionFailure";

/** The alert for what the last preview or confirmation ran into. */
export function FailureAlert({
  failure,
  next,
  preview,
}: {
  failure: RevisionFailure;
  next: number | null;
  preview: boolean;
}) {
  const { t } = useTranslation("orders");
  const title = (key: string) => t(`form.revision.${key}`, { next });
  const common =
    failure.traceId === undefined ? {} : { traceId: failure.traceId };
  switch (failure.kind) {
    case "fields":
      return (
        <RevisionAlert
          title={title(preview ? "previewFailedTitle" : "failedTitle")}
          issues={failure.issues}
          {...common}
        />
      );
    case "stale":
      return (
        <RevisionAlert
          title={title("staleTitle")}
          message={failure.message}
          extra={
            failure.current === null
              ? undefined
              : t("form.revision.staleHint", { current: failure.current })
          }
          {...common}
        />
      );
    case "closed":
      return (
        <RevisionAlert
          title={title("closedTitle")}
          message={failure.message}
          {...common}
        />
      );
    case "refused":
      return (
        <RevisionAlert
          title={title(preview ? "previewFailedTitle" : "failedTitle")}
          message={failure.message}
          extra={preview ? undefined : t("form.revision.nothingSaved")}
          {...common}
        />
      );
    case "unknown":
      return (
        <RevisionAlert
          title={title(preview ? "previewFailedTitle" : "unknownTitle")}
          extra={preview ? undefined : t("form.revision.unknownBody", { next })}
          {...common}
        />
      );
  }
}
