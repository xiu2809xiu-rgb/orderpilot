import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** What sits under the fields: the note on the required mark, then the buttons. */
export function FormActions({
  note,
  children,
}: {
  /** Replaces the note on the required mark, for a form with none. */
  note?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("form");
  note ??= t("requiredNote");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-s2">
      <p className="text-xs text-muted-foreground">{note}</p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
