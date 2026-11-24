import { CircleCheck, CircleX, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ErrorPanel } from "@/components/common";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";
import { StatusChip } from "@/components/kit/StatusChip";
import { Section } from "@/components/parts/Section";
import {
  SettingFootnote,
  SettingList,
  SettingRow,
} from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { Bone } from "../../shell/skeletons/Bone";
import { useServiceHealth } from "./useServiceHealth";

/**
 * Is everything working? One line for the answer and a button to ask again;
 * the services themselves are behind "Show details", and open by themselves
 * when one is down, with what that means for people's work. The reason a check
 * failed stays in the server log, so this shows up or down only.
 */
export function HealthPanel() {
  const { t } = useTranslation("settings");
  const health = useServiceHealth();
  const { query } = health;

  return (
    <Section title={t("health.title")}>
      {query.isPending ? (
        <div role="status">
          <span className="sr-only">{t("health.loading")}</span>
          <Bone className="h-10 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorPanel
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <SettingList>
            <SettingRow
              label={
                health.allUp ? (
                  <StatusChip kind="success" icon={CircleCheck}>
                    {t("health.allUp")}
                  </StatusChip>
                ) : (
                  <StatusChip kind="destructive" icon={CircleX}>
                    {t("health.someDown", { count: health.down.length })}
                  </StatusChip>
                )
              }
              description={t("health.checkedAt", {
                time: formatTime(health.checkedAt),
              })}
              control={
                <Button
                  variant="outline"
                  disabled={query.isFetching}
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  <RotateCw
                    aria-hidden="true"
                    className={
                      query.isFetching ? "motion-safe:animate-spin" : ""
                    }
                  />
                  {t("health.again")}
                </Button>
              }
            />
          </SettingList>
          <details open={health.allUp ? undefined : true} className="mt-s3">
            <summary className="fs-14 w-fit cursor-pointer font-medium pointer-coarse:min-h-11">
              {t("health.details")}
            </summary>
            <ul className="mt-s2 divide-y divide-border">
              {health.checks.map((check) => (
                <li
                  key={check.name}
                  className="fs-14 flex items-center justify-between gap-s3 py-s2"
                >
                  <span className="min-w-0">
                    {t(`health.names.${check.name}`, {
                      defaultValue: check.name,
                    })}
                  </span>
                  {check.status === "up" ? (
                    <StatusChip kind="success" icon={CircleCheck}>
                      {t("health.up", { ms: check.durationMs })}
                    </StatusChip>
                  ) : (
                    <StatusChip kind="destructive" icon={CircleX}>
                      {t("health.down")}
                    </StatusChip>
                  )}
                </li>
              ))}
            </ul>
          </details>
          {health.allUp ? null : (
            <>
              <Alert variant="destructive" className="mt-s4">
                <AlertTitle>{t("health.affects.title")}</AlertTitle>
                <AlertDescription>
                  {health.down.map((check) => (
                    <span key={check.name}>
                      {t(`health.affects.${check.name}`, { defaultValue: "" })}
                    </span>
                  ))}
                </AlertDescription>
              </Alert>
              <SettingFootnote>{t("health.footnote")}</SettingFootnote>
            </>
          )}
        </>
      )}
    </Section>
  );
}
