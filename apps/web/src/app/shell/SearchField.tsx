import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * The search and jump field of the top bar. It is a button that reads like a
 * field and opens the command palette; Ctrl K or Command K opens it from
 * anywhere (AppShell listens for the keys).
 */
export function SearchField({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  // No aria-label: the visible words are the name, so a screen reader and a
  // person using speech control say the same thing (WCAG 2.5.3). The shortcut
  // hint beside them is aria-hidden.
  return (
    <button
      type="button"
      className="dx-search w-64"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={onOpen}
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left max-xl:sr-only">
        {t("shell.search")}
      </span>
      <kbd className="dx-kbd max-xl:hidden" aria-hidden="true">
        {t("palette.keys")}
      </kbd>
    </button>
  );
}
