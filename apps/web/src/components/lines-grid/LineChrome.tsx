import { CircleAlert, Trash2 } from "lucide-react";
import { get, useFormContext, useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useGrid } from "./gridContext";
import type { ColumnKind } from "./types";

/** The first column: the line's number, and a mark when something on it is wrong. */
export function LineNumberCell({ index, row }: { index: number; row: string }) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  const { errors } = useFormState({ control, name: row });
  const wrong = get(errors, row) !== undefined;
  return (
    <span className="flex min-h-8 items-center gap-1 text-sm font-medium tabular-nums">
      <span aria-hidden="true">
        <span className="@lines:hidden">{t("lineWord")} </span>
        {index + 1}
      </span>
      <span className="sr-only">{t("cells.lineNo", { n: index + 1 })}</span>
      {wrong ? (
        <>
          <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
          <span className="sr-only">{t("lineHasError")}</span>
        </>
      ) : null}
    </span>
  );
}

/** A visible button with its own name, so that nobody needs a shortcut to remove a line. */
export function RemoveCell({ index }: { index: number }) {
  const { t } = useTranslation("linesGrid");
  const grid = useGrid();
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={t("remove", { n: index + 1 })}
      className="h-8 w-full justify-start pointer-coarse:h-11 @max-lines:h-11 @lines:w-8 @lines:justify-center @lines:px-0 @lines:pointer-coarse:w-11"
      onClick={() => {
        grid.remove(index, "remove" satisfies ColumnKind);
      }}
    >
      <Trash2 aria-hidden="true" />
      <span className="@lines:sr-only">{t("removeShort")}</span>
    </Button>
  );
}
