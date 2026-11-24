import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { useAiProbe } from "@/lib/api/generated/endpoints/ai/ai";
import type { AiProbe200Data } from "@/lib/api/generated/model";

function outcomeText(
  data: AiProbe200Data,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (data.outcome === "ok") {
    if (data.inputTokens !== null && data.outputTokens !== null) {
      return t("ai.probe.okTokens", {
        ms: data.latencyMs,
        input: data.inputTokens,
        output: data.outputTokens,
      });
    }
    return t("ai.probe.ok", { ms: data.latencyMs });
  }
  return t(`ai.probe.${data.outcome}`, { code: data.reasonCode ?? "unknown" });
}

/**
 * Asks the server to send one fixed sample question to the AI and report how
 * it went. Only the system admin may (`settings.manage`); the server refuses
 * anyone else and records every test. The result is announced politely: it is
 * the answer to a button the person just pressed.
 */
export function AiProbeRow() {
  const { t } = useTranslation("settings");
  // A button, not a page load: the generated hook runs only when asked.
  const probe = useAiProbe(
    { mode: "text" },
    { query: { enabled: false, retry: false, gcTime: 0 } },
  );
  return (
    <SettingRow
      label={t("ai.probe.label")}
      description={t("ai.probe.description")}
      control={({ descriptionId }) => (
        <Button
          variant="outline"
          disabled={probe.isFetching}
          aria-describedby={descriptionId}
          onClick={() => {
            void probe.refetch();
          }}
        >
          <RotateCw
            aria-hidden="true"
            className={probe.isFetching ? "motion-safe:animate-spin" : ""}
          />
          {probe.isFetching ? t("ai.probe.sending") : t("ai.probe.button")}
        </Button>
      )}
    >
      <div aria-live="polite" className="fs-14 text-muted-foreground">
        {probe.isFetching
          ? null
          : probe.isError
            ? t("ai.probe.failed", { traceId: probe.error.traceId })
            : probe.data
              ? outcomeText(probe.data.data, (key, options) => t(key, options))
              : null}
      </div>
    </SettingRow>
  );
}
