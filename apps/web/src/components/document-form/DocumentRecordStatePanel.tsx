import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  ErrorPanel,
  LoadingState,
  PermissionDenied,
} from "@/components/common";
import type { DocumentRecordState } from "./types";

/** The record-level states, drawn from the same pieces the lists use. */
export function DocumentRecordStatePanel({
  state,
}: {
  state: DocumentRecordState;
}) {
  const { t } = useTranslation("document-form");
  switch (state.kind) {
    case "loading":
      return <LoadingState lines={6} />;
    case "error":
      return (
        <ErrorPanel
          error={state.error}
          {...(state.onRetry ? { onRetry: state.onRetry } : {})}
        />
      );
    case "denied":
      return (
        <PermissionDenied
          {...(state.description ? { description: state.description } : {})}
        />
      );
    case "notFound":
      return (
        <EmptyState
          icon={SearchX}
          title={t("state.notFoundTitle")}
          description={state.description ?? t("state.notFoundDescription")}
        />
      );
  }
}
