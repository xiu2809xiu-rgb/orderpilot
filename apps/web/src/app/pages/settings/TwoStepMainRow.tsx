import type { TwoStepStatus } from "@orderpilot/shared";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/kit/StatusChip";
import { SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { TwoStepNotes } from "./TwoStepNotes";
import { hasTwoStepNotes, type TwoStepDialog } from "./twoStepCardRules";

/** The state of two-step and the one button that changes it. Where nothing could work, a line says why instead. */
export function TwoStepMainRow({
  status,
  open,
}: {
  status: TwoStepStatus;
  open: (dialog: TwoStepDialog) => void;
}) {
  const { t } = useTranslation("settings");
  const on = status.state === "on";
  const refusal = !status.hasPassword
    ? t("account.twoStep.noPassword")
    : status.demoAdminBlocked && !on
      ? t("account.twoStep.demoAdmin")
      : null;
  return (
    <SettingRow
      label={t("account.twoStep.row.label")}
      description={
        refusal ??
        (on
          ? t("account.twoStep.row.descriptionOn")
          : t("account.twoStep.row.descriptionOff"))
      }
      align="start"
      control={
        refusal
          ? undefined
          : ({ descriptionId }) => (
              <div className="flex flex-wrap items-center gap-s3">
                <StatusChip
                  kind={on ? "success" : "info"}
                  icon={on ? ShieldCheck : ShieldOff}
                >
                  {on
                    ? t("account.twoStep.state.on")
                    : t("account.twoStep.state.off")}
                </StatusChip>
                {on && status.enabledAt ? (
                  <span className="fs-12 text-muted-foreground">
                    {t("account.twoStep.since", {
                      date: formatDay(status.enabledAt),
                    })}
                  </span>
                ) : null}
                <Button
                  variant={on ? "outline" : "default"}
                  aria-describedby={descriptionId}
                  onClick={() => {
                    open(on ? "disable" : "setup");
                  }}
                >
                  {on
                    ? t("account.twoStep.turnOff")
                    : t("account.twoStep.turnOn")}
                </Button>
              </div>
            )
      }
    >
      {hasTwoStepNotes(status) ? <TwoStepNotes status={status} /> : null}
    </SettingRow>
  );
}
