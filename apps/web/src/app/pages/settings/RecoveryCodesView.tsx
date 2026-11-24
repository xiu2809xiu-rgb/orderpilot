import { Check, Copy, Download } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
// The file, not the barrel: the barrel pulls in the whole data table.
import { downloadFile } from "@/components/common/data-table/export/download";

interface RecoveryCodesViewProps {
  codes: string[];
  /** Pressed after "I have saved these codes" is ticked. */
  onDone: () => void;
}

/**
 * The ten recovery codes, shown once. The dialog around it cannot be closed
 * until the box is ticked and Done is pressed. It holds the codes only in its
 * props: nothing here writes them to a query cache, a draft or a URL.
 */
export function RecoveryCodesView({ codes, onDone }: RecoveryCodesViewProps) {
  const { t } = useTranslation("settings");
  const [saved, setSaved] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const savedId = useId();

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  function download() {
    const body = [
      t("account.twoStep.recoveryView.fileTitle"),
      t("account.twoStep.recoveryView.fileNote"),
      "",
      ...codes,
      "",
    ].join("\n");
    downloadFile("orderpilot-recovery-codes.txt", body, "text/plain");
  }

  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-label={t("account.twoStep.recoveryView.listLabel")}
        className="grid grid-cols-1 gap-2 rounded-md border bg-muted/40 p-3 min-[400px]:grid-cols-2"
      >
        {codes.map((code) => (
          <li key={code} className="fs-14 font-mono tracking-wide break-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void copyAll()}>
          {copy === "copied" ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {t("account.twoStep.recoveryView.copy")}
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <Download aria-hidden="true" />
          {t("account.twoStep.recoveryView.download")}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copy === "copied" ? t("account.twoStep.recoveryView.copied") : null}
        {copy === "failed"
          ? t("account.twoStep.recoveryView.copyFailed")
          : null}
      </span>
      <div className="flex items-center gap-2 pointer-coarse:min-h-11">
        <Checkbox
          id={savedId}
          checked={saved}
          onCheckedChange={(next) => {
            setSaved(next === true);
          }}
        />
        <Label htmlFor={savedId} className="flex-1 py-2">
          {t("account.twoStep.recoveryView.saved")}
        </Label>
      </div>
      <Button type="button" disabled={!saved} onClick={onDone}>
        {t("account.twoStep.recoveryView.done")}
      </Button>
    </div>
  );
}
