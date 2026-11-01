import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RelativeTime } from "@/components/common/RelativeTime";
import { Button } from "@/components/ui/button";
import type { DraftControl } from "./useDraft";

/** Says a draft came back, and offers the way out of it. */
export function DraftNotice({ draft }: { draft: DraftControl }) {
  const { t } = useTranslation("form");
  if (draft.restoredAt === null) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/40 px-s2 py-1 text-xs"
    >
      <History
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span>
        {t("draft.restored")} {t("draft.lastChanged")}{" "}
        <RelativeTime value={draft.restoredAt} />
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="ml-auto"
        onClick={draft.discard}
      >
        {t("draft.discard")}
      </Button>
    </div>
  );
}
