import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Direction } from "../directions";
import { PreviewPalette } from "./PreviewPalette";

/**
 * The search and jump field of the top bar. It is a button that reads like a
 * field and opens the palette; Ctrl K or Command K opens it from anywhere.
 */
export function SearchField({ direction }: { direction: Direction }) {
  const { t } = useTranslation("directions");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((was) => !was);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="dx-search w-64 max-xl:w-auto max-xl:px-2.5"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label={t("bar.paletteTitle")}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left max-xl:sr-only">
          {t("bar.paletteTitle")}
        </span>
        <kbd className="dx-kbd max-xl:hidden" aria-hidden="true">
          {t("bar.keys")}
        </kbd>
      </button>
      <PreviewPalette
        direction={direction}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
