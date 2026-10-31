import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ScrollRegion, SectionCard, StatePanel } from "@/components/common";

// A made-up trace id, so the example never looks like a real refusal.
const SAMPLE_TRACE_ID = "00000000-0000-4000-8000-000000000000";

/** The refusal as people and scripts meet it: on screen, and in the API envelope. */
export function RefusalsTab() {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const envelope = JSON.stringify(
    {
      error: {
        code: "FORBIDDEN",
        message: tc("errors.codes.FORBIDDEN"),
        details: null,
        traceId: SAMPLE_TRACE_ID,
      },
    },
    null,
    2,
  );
  return (
    <SectionCard
      title={t("refusals.title")}
      description={t("refusals.description")}
      actions={<Badge variant="outline">{t("refusals.sample")}</Badge>}
    >
      <div className="grid gap-s3 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("refusals.exampleLabel")}</h3>
          <StatePanel
            variant="inline"
            headingLevel={3}
            icon={ShieldAlert}
            title={t("refusals.exampleTitle")}
            description={t("refusals.exampleDescription")}
            traceLabel={t("refusals.traceLabel")}
            traceId={SAMPLE_TRACE_ID}
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("refusals.envelopeLabel")}</h3>
          <ScrollRegion label={t("refusals.envelopeLabel")}>
            <pre className="overflow-x-auto rounded-lg bg-muted p-s2 font-mono text-xs">{`HTTP 403
${envelope}`}</pre>
          </ScrollRegion>
        </div>
      </div>
    </SectionCard>
  );
}
