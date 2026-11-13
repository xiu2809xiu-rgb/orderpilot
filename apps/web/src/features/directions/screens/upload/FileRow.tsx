import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { extensionOf, FileType } from "@/components/kit/FileType";
import { MAX_FILES, MAX_MB } from "./uploadRules";
import type { UploadRow } from "./useUploads";

/** "84 KB" or "2.4 MB" from a size in bytes. */
function sizeText(
  t: (key: string, options?: Record<string, unknown>) => string,
  bytes: number,
): string {
  return bytes >= 1024 * 1024
    ? t("files.sizeMb", { size: (bytes / (1024 * 1024)).toFixed(1) })
    : t("files.size", { size: Math.max(1, Math.round(bytes / 1024)) });
}

/**
 * One file the person added: its icon, name and size, a progress bar while the
 * browser reads it, then "Ready", or the reason it was refused. Every row can
 * be removed. A refused file keeps its row so the reason stays on the screen.
 */
export function FileRow({
  row,
  onRemove,
}: {
  row: UploadRow;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation("directions-intake");
  const refused = row.status === "refused";
  return (
    <li
      className="flex items-center gap-3 border border-border bg-card px-3 py-2.5"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      <FileType name={row.name} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="fs-14 truncate font-medium text-foreground">
            {row.name}
          </span>
          <span className="numeral fs-12 shrink-0 text-muted-foreground">
            {sizeText(t, row.size)}
          </span>
        </div>
        {row.status === "reading" ? (
          <div
            role="progressbar"
            aria-label={t("files.progress", { name: row.name })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(row.progress * 100)}
            className="h-1.5 w-full overflow-hidden bg-muted"
          >
            <div
              className="h-full bg-ring"
              style={{ width: `${String(Math.round(row.progress * 100))}%` }}
            />
          </div>
        ) : null}
        {row.status === "ready" ? (
          <p className="fs-14 flex items-center gap-1.5 text-success">
            <CircleCheck aria-hidden="true" className="size-3.5" />
            {t("files.ready")}
            <span className="text-muted-foreground">
              {t("files.readyNote")}
            </span>
          </p>
        ) : null}
        {refused ? (
          <p
            role="alert"
            className="fs-14 flex items-start gap-1.5 text-destructive"
          >
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            <span>
              {t(`refused.${row.reason}`, {
                name: row.name,
                size: MAX_MB,
                count: MAX_FILES,
                claimed: (row.claimed ?? extensionOf(row.name)).toUpperCase(),
              })}
            </span>
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("files.remove", { name: row.name })}
        onClick={() => {
          onRemove(row.id);
        }}
        className="shrink-0 pointer-coarse:size-11"
      >
        <X aria-hidden="true" />
      </Button>
    </li>
  );
}
