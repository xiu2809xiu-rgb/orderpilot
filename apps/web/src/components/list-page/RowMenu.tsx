import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOpenRecord } from "@/components/common/useOpenRecord";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSessionStore } from "@/stores/session";
import { blockedReason, KIND_ICONS, labelOf } from "./actions";
import { rowMenuItemsFor, type RowMenuTarget } from "./rowMenuItems";
import type { ListAction } from "./types";

interface RowMenuProps<Row> {
  row: Row;
  target: RowMenuTarget;
  /** The row actions this role may use, in the menu's order (`rowMenuActions`). */
  actions: readonly ListAction<Row>[];
  onRun: (action: ListAction<Row>, rows: readonly Row[]) => void;
}

/**
 * One row's menu: View, Edit, the items every list shares (My work's three,
 * P-57), Copy, then Void or Disable. Each acts on this row only, whatever is
 * ticked. A Void asks for its reason in the list's one dialog.
 */
export function RowMenu<Row>({
  row,
  target,
  actions,
  onRun,
}: RowMenuProps<Row>) {
  const { t } = useTranslation("list-page");
  const session = useSessionStore((state) => state.session);
  // A menu with nothing in it is a dead control, so such a row draws none.
  const empty =
    actions.length === 0 &&
    !target.href &&
    rowMenuItemsFor(session, target).length === 0;
  if (empty) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="pointer-coarse:size-11"
          aria-label={t("rowMenu.open", { row: target.label })}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <RowMenuItems
          row={row}
          target={target}
          actions={actions}
          onRun={onRun}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The menu's items. Drawn only while the menu is open. */
function RowMenuItems<Row>({ row, target, actions, onRun }: RowMenuProps<Row>) {
  const { t } = useTranslation("list-page");
  const { t: tc } = useTranslation("common");
  const openRecord = useOpenRecord();
  const session = useSessionStore((state) => state.session);
  const shared = rowMenuItemsFor(session, target);
  const viewIndex = actions.findIndex((action) => action.kind === "view");
  const before = actions.filter((a) => a.kind === "view" || a.kind === "edit");
  const after = actions.filter((a) => a.kind !== "view" && a.kind !== "edit");
  const { href } = target;

  const item = (action: ListAction<Row>) => {
    const Icon = action.icon ?? KIND_ICONS[action.kind];
    const blocked = blockedReason(action, [row], t);
    return (
      <DropdownMenuItem
        key={action.id}
        disabled={blocked !== undefined}
        className="pointer-coarse:min-h-11"
        onSelect={() => {
          onRun(action, [row]);
        }}
      >
        {Icon ? <Icon aria-hidden="true" /> : null}
        <span className="flex flex-col">
          {labelOf(action, t)}
          {blocked ? (
            <span className="text-xs text-muted-foreground">{blocked}</span>
          ) : null}
        </span>
      </DropdownMenuItem>
    );
  };

  return (
    <>
      {href && viewIndex < 0 ? (
        <DropdownMenuItem
          className="pointer-coarse:min-h-11"
          onSelect={() => {
            openRecord(href, "plain");
          }}
        >
          {KIND_ICONS.view ? <KIND_ICONS.view aria-hidden="true" /> : null}
          {t("actions.view")}
        </DropdownMenuItem>
      ) : null}
      {before.map(item)}
      {shared.length > 0 ? <DropdownMenuSeparator /> : null}
      {shared.map(({ id, label, icon: Icon, run }) => (
        <DropdownMenuItem
          key={id}
          className="pointer-coarse:min-h-11"
          onSelect={() => {
            run(target);
          }}
        >
          <Icon aria-hidden="true" />
          {tc(label)}
        </DropdownMenuItem>
      ))}
      {shared.length > 0 && after.length > 0 ? <DropdownMenuSeparator /> : null}
      {after.map(item)}
    </>
  );
}
