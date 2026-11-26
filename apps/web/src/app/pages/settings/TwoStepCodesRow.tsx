import type { TwoStepStatus } from "@orderpilot/shared";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import type { TwoStepDialog } from "./twoStepCardRules";

/** How many recovery codes are left, and the button that makes new ones. Only while two-step is on. */
export function TwoStepCodesRow({
  status,
  open,
}: {
  status: TwoStepStatus;
  open: (dialog: TwoStepDialog) => void;
}) {
  const { t } = useTranslation("settings");
  if (status.state !== "on" || status.recoveryCodesLeft === null) return null;
  return (
    <SettingRow
      label={t("account.twoStep.recovery.label")}
      description={t("account.twoStep.recovery.left", {
        count: status.recoveryCodesLeft,
      })}
      control={({ descriptionId }) => (
        <Button
          variant="outline"
          aria-describedby={descriptionId}
          onClick={() => {
            open("codes");
          }}
        >
          <KeyRound aria-hidden="true" />
          {t("account.twoStep.recovery.make")}
        </Button>
      )}
    />
  );
}
