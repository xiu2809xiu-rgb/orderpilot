import { useTranslation } from "react-i18next";
import type { DataTableColumn, ExportOptions } from "@/components/common";
import { ExportMenu } from "@/components/common/data-table/ExportMenu";
import type { RowPage } from "@/components/common/data-table/useUrlQuery";
import { cn } from "@/lib/utils";
import { ActionButton } from "./ActionButton";
import { blockedReason, KIND_ICONS, labelOf, LEFT_KINDS } from "./actions";
import { PrintButton } from "./PrintButton";
import { SelectionCount } from "./SelectionCount";
import type { ListAction } from "./types";

interface ActionBarProps<Row> {
  /** Only the actions this role may use, in the bar's order. */
  actions: readonly ListAction<Row>[];
  /** The rows ticked in the grid. */
  selection: readonly Row[];
  /** Whether the grid has checkboxes, so the bar counts what is ticked. */
  selectable: boolean;
  onClearSelection: () => void;
  /** Runs an action with the ticked rows, asking for a reason first when it needs one. */
  onRun: (action: ListAction<Row>, rows: readonly Row[]) => void;
  title: string;
  /** The applied filters in words, for the print view. */
  filterWords: readonly string[];
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  exportOptions?: ExportOptions<Row> | undefined;
  /** Every row the filter shows, a page at a time, for Print. */
  pages?: (() => AsyncIterable<RowPage<Row>>) | undefined;
  /**
   * Draws no row of its own: used when the screen has only Import, Export and
   * Print, which then share the filter bar's row instead of leaving one empty.
   */
  compact?: boolean;
}

/**
 * New, Edit, Void or Disable, batch actions, Import, Export and Print, in that
 * order, with the count of ticked rows. Export and Print are done here; the
 * rest call the screen. An action that needs a selection says so until rows
 * are selected.
 */
export function ActionBar<Row>({
  actions,
  selection,
  selectable,
  onClearSelection,
  onRun,
  title,
  filterWords,
  columns,
  rows,
  exportOptions,
  pages,
  compact = false,
}: ActionBarProps<Row>) {
  const { t } = useTranslation("list-page");
  if (actions.length === 0 && !selectable) return null;

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
          pages={pages}
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
          onRun(action, selection);
        }}
      />
    );
  };

  const left = actions.filter((a) => LEFT_KINDS.includes(a.kind));
  const right = actions.filter((a) => !LEFT_KINDS.includes(a.kind));
  return (
    <div
      role="group"
      aria-label={t("actions.label")}
      className="flex flex-wrap items-center gap-2"
    >
      {left.map(draw)}
      {selectable ? (
        <SelectionCount count={selection.length} onClear={onClearSelection} />
      ) : null}
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
    </div>
  );
}
