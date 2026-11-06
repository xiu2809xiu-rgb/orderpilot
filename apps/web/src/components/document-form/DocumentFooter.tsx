import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/common";
import type { AttachmentItem, DocumentStatus, FooterFigure } from "./types";

interface DocumentFooterProps {
  status: DocumentStatus;
  attachments: readonly AttachmentItem[];
  totals: readonly FooterFigure[];
}

/**
 * The foot of the form: attachments on the left, the status chip, and the
 * totals on the right. The chip carries a word and an icon, never a colour
 * alone.
 */
export function DocumentFooter({
  status,
  attachments,
  totals,
}: DocumentFooterProps) {
  const { t } = useTranslation("document-form");
  return (
    <footer className="grid gap-s2 border-t pt-s2 md:grid-cols-[1fr_auto_auto] md:items-start">
      <section aria-label={t("footer.attachments")} className="space-y-1">
        <h3 className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden="true" />
          {t("footer.attachmentsCount", { count: attachments.length })}
        </h3>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("footer.noAttachments")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((item) => (
              <li
                key={item.id}
                className="rounded-md border px-2 py-1 text-sm pointer-coarse:py-2.5"
              >
                {item.href ? (
                  <a href={item.href} className="underline underline-offset-2">
                    {item.name}
                  </a>
                ) : (
                  item.name
                )}
                {item.size ? (
                  <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                    {item.size}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("footer.status")}
        </p>
        <StatusChip family={status.family}>{status.label}</StatusChip>
      </div>
      {totals.length > 0 ? (
        <dl className="space-y-1 text-sm md:text-right">
          {totals.map((figure) => (
            <div key={figure.id} className="flex justify-between gap-s3">
              <dt className="text-muted-foreground">{figure.label}</dt>
              <dd className="font-medium tabular-nums">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </footer>
  );
}
