import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * The line under the panel's header block: why the typed dates may be wrong, and
 * the button that puts the stored order's dates and prepayment in their place,
 * with a hint under it saying that it replaces what was typed.
 */
export function KeepHeader({
  busy,
  onKeep,
}: {
  busy: boolean;
  onKeep: () => void;
}) {
  const { t } = useTranslation("orders");
  const hintId = useId();
  return (
    <div className="flex flex-wrap items-center gap-s2">
      <p className="max-w-[70ch] flex-1 basis-64 text-sm text-muted-foreground">
        {t("form.revision.headerHint")}
      </p>
      <div className="space-y-s1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11"
          aria-disabled={busy}
          aria-describedby={hintId}
          onClick={() => {
            if (!busy) onKeep();
          }}
        >
          {t("form.revision.keepHeader")}
        </Button>
        <p id={hintId} className="max-w-[40ch] text-xs text-muted-foreground">
          {t("form.revision.keepHeaderHint")}
        </p>
      </div>
    </div>
  );
}
