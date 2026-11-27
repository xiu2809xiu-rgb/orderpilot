import type { TwoStepStatus } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/components/kit/Alert";
import { formatDay } from "@/lib/format";
import { FEW_CODES } from "./twoStepCardRules";

/** Warnings under the first row: few recovery codes left, and a lock in the last 7 days. */
export function TwoStepNotes({ status }: { status: TwoStepStatus }) {
  const { t } = useTranslation("settings");
  const left = status.recoveryCodesLeft;
  return (
    <div className="flex flex-col gap-s2">
      {status.state === "on" && left !== null && left <= FEW_CODES ? (
        <Alert variant="warning">
          <AlertTitle>
            {t("account.twoStep.recovery.low", { count: left })}
          </AlertTitle>
        </Alert>
      ) : null}
      {status.lastLockedAt ? (
        <Alert variant="warning">
          <AlertTitle>
            {t("account.twoStep.recentLock", {
              date: formatDay(status.lastLockedAt),
            })}
          </AlertTitle>
        </Alert>
      ) : null}
    </div>
  );
}
