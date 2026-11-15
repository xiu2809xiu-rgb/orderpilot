import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatLongDay } from "@/lib/format";
import { usePrimaryAction, type PrimaryAction } from "./primaryAction";
import "./page-header.css";

interface PageHeaderProps {
  title: string;
  /** The one line under the title. */
  description?: string;
  /** The same line, under the name the parts head gave it. `description` wins. */
  intro?: string;
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
  /** 2 for a header inside a page that already has its h1, such as a gallery section. */
  headingLevel?: 1 | 2;
  /** Today's date under the title, for the home page. A list has no use for it. */
  showDate?: boolean;
}

/**
 * The head of every page: the gradient title with its count, one line under
 * it, and the page's buttons on the right with at most one primary button. It
 * is the one head of the app: the parts head (`components/parts/PageHeader`)
 * draws the same markup and classes, so a screen reads the same wherever it is.
 */
export function PageHeader({
  title,
  description,
  intro,
  meta,
  total,
  primaryAction,
  actions,
  headingLevel = 1,
  showDate = false,
}: PageHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const { t } = useTranslation("components");
  usePrimaryAction(primaryAction);
  const Icon = primaryAction?.icon ?? Plus;
  const line = description ?? intro;
  return (
    <header className="dx-page-head ph-head">
      <div className="ph-title">
        <Heading
          className={
            headingLevel === 1
              ? "dx-title"
              : "fs-20 font-semibold tracking-tight"
          }
        >
          {title}
        </Heading>
        {total !== undefined ? (
          <span className="ph-count">
            <span aria-hidden="true">{total.toLocaleString("en")}</span>
            <span className="sr-only">
              {t("header.total", { count: total })}
            </span>
          </span>
        ) : null}
        {meta}
      </div>
      {showDate ? (
        <p className="dx-title-context">{formatLongDay(new Date())}</p>
      ) : null}
      {line ? <p className="dx-page-intro fs-14 max-w-prose">{line}</p> : null}
      {actions || primaryAction ? (
        <div className="dx-page-actions">
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
