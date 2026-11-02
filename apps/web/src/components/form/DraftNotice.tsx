import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RelativeTime } from "@/components/common/RelativeTime";
import { Button } from "@/components/ui/button";
import type { DraftControl } from "./useDraft";

const FIRST_FIELD =
  'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), button[role="combobox"]:not(:disabled)';

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
        className="ml-auto pointer-coarse:min-h-11"
        onClick={(event) => {
          // The notice goes with the draft, and focus with it: hand it to the
          // first field so a keyboard user is not sent back to the page top.
          const form = event.currentTarget.closest("form");
          draft.discard();
          form?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
        }}
      >
        {t("draft.discard")}
      </Button>
    </div>
  );
}
