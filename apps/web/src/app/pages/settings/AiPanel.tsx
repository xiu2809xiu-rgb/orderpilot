import { useTranslation } from "react-i18next";
import { ErrorPanel } from "@/components/common";
import { DemoBadge } from "@/components/common/DemoBadge";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { useAiGetStatus } from "@/lib/api/generated/endpoints/ai/ai";
import { hasPermission, useSessionStore } from "@/stores/session";
import { Bone } from "../../shell/skeletons/Bone";
import { AiProbeRow } from "./AiProbeRow";

/**
 * The AI: which model answers, what it may see, and for the system admin a
 * test of the connection. The provider and model are set on the server, so
 * this page only reads them. The status and the test fail independently.
 */
export function AiPanel() {
  const { t } = useTranslation("settings");
  const session = useSessionStore((state) => state.session);
  const status = useAiGetStatus();
  const canProbe = hasPermission(session, "settings.manage");
  const current = status.data?.data;

  return (
    <Section title={t("ai.title")} intro={t("ai.intro")}>
      <SettingList>
        {status.isPending ? (
          <li role="status" className="pb-s3">
            <span className="sr-only">{t("ai.model.loading")}</span>
            <Bone className="h-10 w-full" />
          </li>
        ) : current ? (
          <SettingRow
            label={t("ai.model.label")}
            description={
              current.mock
                ? t("ai.model.mock")
                : t("ai.model.real", { model: current.model })
            }
            control={current.mock ? <DemoBadge kind="mockAi" /> : undefined}
            value={
              current.mock
                ? undefined
                : t(`ai.providers.${current.provider}`, {
                    defaultValue: current.provider,
                  })
            }
          />
        ) : (
          <li className="pb-s3">
            <ErrorPanel
              error={status.error}
              onRetry={() => {
                void status.refetch();
              }}
            />
          </li>
        )}
        {status.isPending ? null : (
          // The synthetic-data promise is true only of the mock. For a live
          // provider the page cannot read the server's policy, so it says who decides.
          <SettingRow
            label={t("ai.sees.label")}
            description={
              current?.mock
                ? t("ai.sees.description")
                : t("ai.sees.descriptionLive")
            }
          />
        )}
        {canProbe ? <AiProbeRow /> : null}
      </SettingList>
      {canProbe ? (
        <SettingFootnote>{t("ai.probe.footnote")}</SettingFootnote>
      ) : null}
    </Section>
  );
}
