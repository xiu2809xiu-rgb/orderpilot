import { useTranslation } from "react-i18next";
import { CommandItem } from "@/components/ui/command";
import type { RecordKind } from "@/lib/records";
import { RECORD_KIND_ICONS } from "./recordKindIcons";

interface PaletteRecordRowProps {
  value: string;
  kind: RecordKind;
  no: string;
  /** The record's name: the customer of an order, the description of an item. */
  name?: string;
  /** The customer's PO number. */
  po?: string;
  stage?: string;
  onSelect: () => void;
}

/**
 * A record in the palette: its icon, its number and its name. Amounts are
 * never shown here, because prices are masked for some roles.
 */
export function PaletteRecordRow({
  value,
  kind,
  no,
  name,
  po,
  stage,
  onSelect,
}: PaletteRecordRowProps) {
  const { t } = useTranslation(["common", "record-tabs"]);
  const Icon = RECORD_KIND_ICONS[kind];
  const kindName = t(`kinds.${kind}`, { ns: "record-tabs" });
  const poText = po ? t("palette.po", { po }) : undefined;
  // One name for a screen reader that carries every word the row shows, so it
  // reads the same as the row looks (WCAG 2.5.3).
  const label = [
    t("palette.rowName", { kind: kindName, no }),
    name,
    poText,
    stage,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <CommandItem value={value} aria-label={label} onSelect={onSelect}>
      <Icon aria-hidden="true" />
      <span className="shrink-0 font-medium tabular-nums">{no}</span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {name ?? kindName}
      </span>
      {poText ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {poText}
        </span>
      ) : null}
      {stage ? (
        <span className="max-w-[10rem] shrink-0 truncate text-xs text-muted-foreground">
          {stage}
        </span>
      ) : null}
    </CommandItem>
  );
}
