import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Field } from "./Field";

interface SearchBoxProps {
  value: string;
  onSearch: (value: string) => void;
  /** Wait this long after the last key before asking the server. */
  debounceMs: number;
  label?: string;
}

/** The one quick search. What is typed shows at once; the server is asked after a short pause. */
export function SearchBox({
  value,
  onSearch,
  debounceMs,
  label,
}: SearchBoxProps) {
  const { t } = useTranslation("components");
  const id = useId();
  const [draft, setDraft] = useState(value);
  // The last value this box sent up, and the last one it was given. A value
  // that comes back unchanged is our own echo; anything else came from the
  // page (a saved filter, "clear") and replaces what is typed.
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);
  const latest = useRef({ value, onSearch });
  useEffect(() => {
    latest.current = { value, onSearch };
  });

  if (value !== seen) {
    setSeen(value);
    setSent(value);
    if (value !== sent) setDraft(value);
  }

  useEffect(() => {
    if (draft === latest.current.value) return;
    const timer = setTimeout(() => {
      setSent(draft);
      latest.current.onSearch(draft);
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, debounceMs]);

  return (
    <Field label={label ?? t("table.search")} htmlFor={id}>
      <div className="dt-search">
        <Search aria-hidden="true" />
        <Input
          id={id}
          type="search"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder={t("table.searchPlaceholder")}
          // The slash key finds this field (see app/shell/shortcuts.ts).
          data-quick-search=""
          aria-keyshortcuts="/"
          className="dt-control"
        />
        <kbd aria-hidden="true" className="hidden md:block">
          /
        </kbd>
      </div>
    </Field>
  );
}
