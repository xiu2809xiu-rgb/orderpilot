import { LoaderCircle } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { LookupState } from "./useLookupSearch";

/** Keeps focus in the search box, where the keyboard works the list. */
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

/** What a lookup says under its results: searching, failed, or nothing found. */
export function LookupFooter({
  status,
  query,
  count,
  onRetry,
}: {
  status: LookupState["status"];
  query: string;
  count: number;
  onRetry: () => void;
}) {
  const { t } = useTranslation("form");
  if (status === "loading") {
    return (
      <p className="flex items-center gap-1.5 border-t px-2 py-1.5 text-xs text-muted-foreground first:border-t-0">
        <LoaderCircle
          className="size-3 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t("lookup.searching")}
      </p>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
        <span className="text-destructive">{t("lookup.failed")}</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          tabIndex={-1}
          onMouseDown={keepFocus}
          onClick={onRetry}
          className="ml-auto"
        >
          {t("lookup.retry")}
        </Button>
      </div>
    );
  }
  if (status === "done" && count === 0) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        {query.trim() === ""
          ? t("lookup.typeToSearch")
          : t("lookup.noResults", { query: query.trim() })}
      </p>
    );
  }
  return null;
}
