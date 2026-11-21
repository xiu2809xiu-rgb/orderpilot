import { TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { extensionOf } from "@/components/kit/FileType";
import { MAX_FILES, MAX_MB } from "./uploadRules";
import type { Refused } from "./useUploads";

/**
 * Why a file was not added, one message for each, apart from the list of the
 * files that were. A refused file and a second copy are not rows: a row would
 * offer to remove, and Spark to read, a file that is not there. Each message
 * can be dismissed, and the next files added start them afresh.
 */
export function RefusedNotes({
  notes,
  onDismiss,
}: {
  notes: readonly Refused[];
  onDismiss: (id: number) => void;
}) {
  const { t } = useTranslation("directions-intake");
  if (notes.length === 0) return null;
  return (
    <ul aria-label={t("refused.label")} className="flex flex-col gap-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className="fs-14 flex items-start gap-2 border border-border bg-card px-3 py-2 text-destructive"
          style={{ borderRadius: "var(--radius-control)" }}
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {/* The alert is on the text, not the item: a role on an item takes away
              its role as a list item. */}
          <span role="alert" className="min-w-0 flex-1">
            {t(`refused.${note.reason}`, {
              name: note.name,
              size: MAX_MB,
              count: MAX_FILES,
              claimed: t(
                `refused.claimed.${note.claimed ?? extensionOf(note.name)}`,
                { defaultValue: "a" },
              ),
            })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("refused.dismiss", { name: note.name })}
            data-dismiss=""
            onClick={() => {
              onDismiss(note.id);
            }}
            className="-my-1 size-6 shrink-0 text-muted-foreground pointer-coarse:size-11"
          >
            <X aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
