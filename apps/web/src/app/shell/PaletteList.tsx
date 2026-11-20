import {
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { AppAction } from "@/lib/actions";
import type { PaletteRow, PaletteSection } from "./paletteModel";
import { PaletteRecordRow } from "./PaletteRecordRow";

/** The value cmdk keeps for a row. Unique across the list, so one row is highlighted at a time. */
export function rowValue(row: PaletteRow): string {
  if (row.type === "record") return row.hit.id;
  if (row.type === "recent") return `recent:${row.tab.key}`;
  return `${row.entry.to ? "page" : "action"}:${row.entry.id}`;
}

interface PaletteListProps {
  sections: readonly PaletteSection[];
  onGo: (path: string) => void;
  onRun: (action: AppAction) => void;
}

/** The groups of rows. Each row opens a place or runs an action when chosen. */
export function PaletteList({ sections, onGo, onRun }: PaletteListProps) {
  return (
    <CommandList>
      {sections.map((section) => (
        <CommandGroup key={section.id} heading={section.heading}>
          {section.rows.map((row) => {
            const value = rowValue(row);
            if (row.type === "record") {
              const { hit } = row;
              return (
                <PaletteRecordRow
                  key={value}
                  value={value}
                  kind={hit.kind}
                  no={hit.no}
                  name={hit.name}
                  {...(hit.po ? { po: hit.po } : {})}
                  {...(hit.stage ? { stage: hit.stage } : {})}
                  onSelect={() => {
                    onGo(hit.to);
                  }}
                />
              );
            }
            if (row.type === "recent") {
              const { tab } = row;
              return (
                <PaletteRecordRow
                  key={value}
                  value={value}
                  kind={tab.kind}
                  no={tab.no}
                  onSelect={() => {
                    onGo(tab.to);
                  }}
                />
              );
            }
            const { entry } = row;
            return (
              <CommandItem
                key={value}
                value={value}
                onSelect={() => {
                  if (entry.action) onRun(entry.action);
                  else if (entry.to) onGo(entry.to);
                }}
              >
                <entry.icon aria-hidden="true" />
                {entry.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      ))}
    </CommandList>
  );
}
