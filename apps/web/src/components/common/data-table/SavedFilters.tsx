import { Bookmark, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SavedFilter } from "./types";

interface SavedFiltersProps {
  saved: readonly SavedFilter[];
  onApply: (filter: SavedFilter) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

/** Named filters, kept in this browser for this viewer, so they survive a reload. */
export function SavedFilters({
  saved,
  onApply,
  onSave,
  onDelete,
}: SavedFiltersProps) {
  const { t } = useTranslation("components");
  const nameId = useId();
  const [name, setName] = useState("");

  function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark aria-hidden="true" />
          {t("table.saved")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("table.savedNone")}
          </p>
        ) : (
          <ul className="space-y-1">
            {saved.map((filter) => (
              <li key={filter.id} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start"
                  aria-label={t("table.savedApply", { name: filter.name })}
                  onClick={() => {
                    onApply(filter);
                  }}
                >
                  {filter.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("table.savedDelete", { name: filter.name })}
                  onClick={() => {
                    onDelete(filter.id);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit} className="space-y-2 border-t pt-3">
          <label htmlFor={nameId} className="text-sm font-medium">
            {t("table.savedName")}
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            maxLength={60}
          />
          <Button type="submit" size="sm" disabled={name.trim() === ""}>
            {t("table.savedSave")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("table.savedHint")}
          </p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
