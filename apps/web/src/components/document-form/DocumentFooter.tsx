import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import { safeHref } from "./safeHref";
import type { AttachmentItem, FooterFigure } from "./types";

interface DocumentFooterProps {
  attachments: readonly AttachmentItem[];
  totals: readonly FooterFigure[];
}

/**
 * The foot of the form, inside its own card: the attachments on the left and
 * the totals on the right, in tabular figures. The card carries the title, so
 * the count here is a line of its own and not a second heading.
 */
export function DocumentFooter({ attachments, totals }: DocumentFooterProps) {
  const { t } = useTranslation("document-form");
  return (
    <footer className="df-footer">
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden="true" />
          {t("footer.attachmentsCount", { count: attachments.length })}
        </p>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("footer.noAttachments")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((item) => {
              const href = safeHref(item.href);
              return (
                <li key={item.id} className="df-attachment">
                  {href ? (
                    <a href={href} className="underline underline-offset-2">
                      {item.name}
                    </a>
                  ) : (
                    item.name
                  )}
                  {item.size ? (
                    <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                      {item.size}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {totals.length > 0 ? (
        <dl className="df-totals">
          {totals.map((figure) => (
            <div key={figure.id} className="flex justify-between gap-s3">
              <dt className="text-muted-foreground">{figure.label}</dt>
              <dd className="numeral font-medium">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </footer>
  );
}
