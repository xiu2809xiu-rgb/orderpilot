import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { CommandInput } from "@/components/ui/command";
import type { AppAction } from "@/lib/actions";
import { PaletteDialog } from "./PaletteDialog";
import { PaletteList, rowValue } from "./PaletteList";
import { PaletteNotices } from "./PaletteNotices";
import { NAMESPACES, usePaletteModel } from "./paletteModel";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

/** What the keyboard can do, always visible under the list. */
function ShortcutHelp() {
  const { t } = useTranslation("common");
  return (
    <ul
      aria-label={t("palette.helpLabel")}
      className="flex flex-wrap gap-x-s3 gap-y-1 border-t px-s2 py-s1 text-xs text-muted-foreground"
    >
      <li className="flex items-center gap-1.5">
        <Key>{"/"}</Key> {t("palette.helpSearch")}
      </li>
      <li className="flex items-center gap-1.5">
        <Key>{"N"}</Key> {t("palette.helpNew")}
      </li>
      <li className="flex items-center gap-1.5">
        <Key>{t("palette.keys")}</Key> {t("palette.helpPalette")}
      </li>
    </ul>
  );
}

/**
 * The command palette, opened by Control K or Command K. Typed, it finds the
 * orders, customers, vendors and items the role may read, then the pages and
 * actions that match. With nothing typed it lists the records opened lately,
 * the pages and the actions.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation(NAMESPACES);
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [highlighted, setHighlighted] = useState("");
  const { query, sections, count, lookedUp, records } = usePaletteModel(raw);
  const opener = useRef<HTMLElement | null>(null);

  // Radix returns focus to a trigger, and the palette has none: remember who
  // had focus before it opened and give it back on close.
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
  }, [open]);

  // The next opening starts clean.
  useEffect(() => {
    if (!open) setRaw("");
  }, [open]);

  // Enter opens the first row unless the person moved: answers that arrive
  // late put new rows on top, and the highlight goes back to the first.
  const rows = sections.flatMap((section) => section.rows);
  const first = rows[0] ? rowValue(rows[0]) : "";
  const order = rows.map(rowValue).join("|");
  useEffect(() => {
    setHighlighted(first);
    // `order` stands for the list itself: a new list starts at its first row.
  }, [first, order]);

  function go(path: string) {
    onOpenChange(false);
    void navigate(path);
  }

  function run(action: AppAction) {
    onOpenChange(false);
    void action.run({
      navigate: (to) => {
        void navigate(to);
      },
    });
  }

  return (
    <PaletteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("palette.title")}
      description={t("palette.description")}
      value={highlighted}
      onValueChange={setHighlighted}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = opener.current?.isConnected
          ? opener.current
          : document.getElementById("main");
        target?.focus();
      }}
    >
      <CommandInput
        placeholder={t("palette.placeholder")}
        value={raw}
        onValueChange={setRaw}
      />
      <PaletteList sections={sections} onGo={go} onRun={run} />
      <PaletteNotices
        query={query}
        lookedUp={lookedUp}
        records={records}
        count={count}
      />
      <ShortcutHelp />
    </PaletteDialog>
  );
}
