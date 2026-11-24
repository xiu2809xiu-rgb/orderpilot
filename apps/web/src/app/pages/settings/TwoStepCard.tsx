import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorPanel } from "@/components/common";
import { Section } from "@/components/parts/Section";
import { SettingFootnote, SettingList } from "@/components/parts/SettingRow";
import { Bone } from "../../shell/skeletons/Bone";
import { TwoStepCodesRow } from "./TwoStepCodesRow";
import { TwoStepMainRow } from "./TwoStepMainRow";
import type { TwoStepDialog } from "./twoStepCardRules";
import { useTwoStepStatus } from "./useTwoStepStatus";

// Each dialog is a chunk of its own, and the QR code with the setup one.
const TwoStepSetupDialog = lazy(() =>
  import("./TwoStepSetupDialog").then((m) => ({
    default: m.TwoStepSetupDialog,
  })),
);
const TwoStepDisableDialog = lazy(() =>
  import("./TwoStepDisableDialog").then((m) => ({
    default: m.TwoStepDisableDialog,
  })),
);
const TwoStepNewCodesDialog = lazy(() =>
  import("./TwoStepNewCodesDialog").then((m) => ({
    default: m.TwoStepNewCodesDialog,
  })),
);

/**
 * Two-step verification, in Settings, Account. The state comes from the
 * server, so the footnote says it is kept there and applies at once: the
 * recorded exception to ADR 0061, whose other choices are kept on this device.
 */
export function TwoStepCard() {
  const { t } = useTranslation("settings");
  const status = useTwoStepStatus();
  const [dialog, setDialog] = useState<TwoStepDialog>(null);
  const data = status.data;
  const close = () => {
    setDialog(null);
  };

  return (
    <Section title={t("account.twoStep.title")}>
      {status.isPending ? (
        <div role="status" className="flex flex-col gap-s2">
          <span className="sr-only">{t("account.twoStep.loading")}</span>
          <Bone className="h-10 w-full" />
        </div>
      ) : data ? (
        <>
          <SettingList>
            <TwoStepMainRow status={data} open={setDialog} />
            <TwoStepCodesRow status={data} open={setDialog} />
          </SettingList>
          <SettingFootnote>
            {t("account.twoStep.footnote")}
            {data.demoSignInSkips && data.hasPassword
              ? ` ${t("account.twoStep.demoSkips")}`
              : ""}
          </SettingFootnote>
        </>
      ) : (
        <ErrorPanel
          error={status.error}
          onRetry={() => {
            void status.refetch();
          }}
        />
      )}
      {dialog === "setup" ? (
        <Suspense fallback={null}>
          <TwoStepSetupDialog onClose={close} />
        </Suspense>
      ) : null}
      {dialog === "disable" ? (
        <Suspense fallback={null}>
          <TwoStepDisableDialog onClose={close} />
        </Suspense>
      ) : null}
      {dialog === "codes" ? (
        <Suspense fallback={null}>
          <TwoStepNewCodesDialog onClose={close} />
        </Suspense>
      ) : null}
    </Section>
  );
}
