import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { usePrimaryAction, type PrimaryAction } from "./primaryAction";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Badges beside the title. */
  meta?: ReactNode;
  /** How many records the list holds, shown quietly beside the title. */
  total?: number;
  /**
   * The list's one primary action. It becomes the button on the right, and
   * the N key runs it. Leave it out where no record is started from this page.
   */
  primaryAction?: PrimaryAction;
  /** Other buttons on the right, beside the primary action. */
  actions?: ReactNode;
}

/** The top of every page: title, a line of context, then actions. */
export function PageHeader({
  title,
  description,
  meta,
  total,
  primaryAction,
  actions,
}: PageHeaderProps) {
  const { t } = useTranslation("components");
  usePrimaryAction(primaryAction);
  const Icon = primaryAction?.icon ?? Plus;
  return (
    <header className="flex flex-wrap items-start justify-between gap-s2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {total !== undefined ? (
            <span className="text-sm text-muted-foreground tabular-nums">
              <span aria-hidden="true">{total.toLocaleString("en")}</span>
              <span className="sr-only">
                {t("header.total", { count: total })}
              </span>
            </span>
          ) : null}
          {meta}
        </div>
        {description ? (
          <p className="measure text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions || primaryAction ? (
        <div className="flex items-center gap-2">
          {actions}
          {primaryAction ? (
            <Button
              onClick={primaryAction.onRun}
              disabled={primaryAction.disabled}
              aria-keyshortcuts="N"
            >
              <Icon aria-hidden="true" />
              {primaryAction.label}
              <kbd
                aria-hidden="true"
                className="ml-1 hidden rounded border border-primary-foreground/40 px-1 font-mono text-xs opacity-80 md:inline"
              >
                N
              </kbd>
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
