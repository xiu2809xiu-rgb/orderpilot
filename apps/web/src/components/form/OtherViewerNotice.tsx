import { UserRoundX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * Stands in for a form once someone else has signed in over it. A reload starts
 * the page afresh for the new person, with records read under their own
 * permissions, and leaves the first person's draft under their own key.
 */
export function OtherViewerNotice() {
  const { t } = useTranslation("form");
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-s2 rounded-xl border bg-(--control-readonly-bg) px-s2 py-s2 text-sm"
    >
      <UserRoundX
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{t("viewer.title")}</p>
        <p className="max-w-[70ch] text-muted-foreground">
          {t("viewer.description")}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          window.location.reload();
        }}
      >
        {t("viewer.reload")}
      </Button>
    </div>
  );
}
