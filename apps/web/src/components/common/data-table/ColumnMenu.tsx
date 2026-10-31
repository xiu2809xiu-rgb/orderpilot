import { Columns3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableColumn } from "./types";

interface ColumnMenuProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  visible: ReadonlySet<string>;
  onChange: (visibleIds: string[]) => void;
  onReset: () => void;
}

/** Column settings: tick the columns to show. The choice is kept per viewer. */
export function ColumnMenu<Row>({
  columns,
  visible,
  onChange,
  onReset,
}: ColumnMenuProps<Row>) {
  const { t } = useTranslation("components");
  const hideable = columns.filter((column) => column.hideable !== false);
  if (hideable.length === 0) return null;

  function toggle(id: string, show: boolean) {
    const next = new Set(visible);
    if (show) next.add(id);
    else next.delete(id);
    onChange(columns.filter((c) => next.has(c.id)).map((c) => c.id));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 aria-hidden="true" />
          {t("table.columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("table.columnsTitle")}</DropdownMenuLabel>
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visible.has(column.id)}
            onSelect={(event) => {
              event.preventDefault();
            }}
            onCheckedChange={(checked) => {
              toggle(column.id, checked);
            }}
          >
            {column.header}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReset}>
          {t("table.columnsReset")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
