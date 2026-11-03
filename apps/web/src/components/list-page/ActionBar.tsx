import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn, ExportOptions } from "@/components/common";
import { ExportMenu } from "@/components/common/data-table/ExportMenu";
import { cn } from "@/lib/utils";
import { ActionButton } from "./ActionButton";
import { blockedReason, KIND_ICONS, labelOf, LEFT_KINDS } from "./actions";
import { PrintButton } from "./PrintButton";
import { ReasonDialog } from "./ReasonDialog";
import type { ListAction } from "./types";

interface ActionBarProps<Row> {
  /** Only the actions this role may use, in the bar's order. */
  actions: readonly ListAction<Row>[];
  /** The rows ticked in the grid. P-45 brings the checkboxes: until then it is empty. */
  selection: readonly Row[];
  title: string;
  /** The applied filters in words, for the print view. */
  filterWords: readonly string[];
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  exportOptions?: ExportOptions<Row> | undefined;
  /**
   * Draws no row of its own: used when the screen has only Import, Export and
   * Print, which then share the filter bar's row instead of leaving one empty.
   */
  compact?: boolean;
}

/**
 * New, Edit, Void or Disable, batch actions, Import, Export and Print, in that
 * order. Export and Print are done here; the rest call the screen. An action
 * that needs a selection says so until rows are selected.
 */
export function ActionBar<Row>({
  actions,
  selection,
  title,
  filterWords,
  columns,
  rows,
  exportOptions,
  compact = false,
}: ActionBarProps<Row>) {
  const { t } = useTranslation("list-page");
  const [asking, setAsking] = useState<ListAction<Row> | null>(null);
  if (actions.length === 0) return null;

  function run(action: ListAction<Row>) {
    if (action.reasoned) setAsking(action);
    else action.onRun?.(selection);
  }

  const draw = (action: ListAction<Row>) => {
    const label = labelOf(action, t);
    if (action.kind === "export") {
      return exportOptions ? (
        <ExportMenu
          key={action.id}
          columns={columns}
          rows={rows}
          {...exportOptions}
        />
      ) : null;
    }
    if (action.kind === "print") {
      return (
        <PrintButton
          key={action.id}
          label={label}
          title={title}
          filters={filterWords}
          columns={columns}
          rows={rows}
          loadRows={exportOptions?.loadRows}
        />
      );
    }
    return (
      <ActionButton
        key={action.id}
        label={label}
        icon={action.icon ?? KIND_ICONS[action.kind]}
        primary={action.kind === "new"}
        blocked={blockedReason(action, selection, t)}
        onRun={() => {
          run(action);
        }}
      />
    );
  };

  const left = actions.filter((a) => LEFT_KINDS.includes(a.kind));
  const right = actions.filter((a) => !LEFT_KINDS.includes(a.kind));
  const reasoned = asking?.reasoned;
  return (
    <div
      role="group"
      aria-label={t("actions.label")}
      className="flex flex-wrap items-center gap-2"
    >
      {left.map(draw)}
      {right.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            !compact && "ml-auto",
          )}
        >
          {right.map(draw)}
        </div>
      ) : null}
      {reasoned ? (
        <ReasonDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null);
          }}
          title={reasoned.title}
          {...(reasoned.description
            ? { description: reasoned.description }
            : {})}
          confirmLabel={reasoned.confirmLabel}
          doneMessage={reasoned.doneMessage(selection)}
          onConfirm={(reason) => reasoned.run(selection, reason)}
        />
      ) : null}
    </div>
  );
}
