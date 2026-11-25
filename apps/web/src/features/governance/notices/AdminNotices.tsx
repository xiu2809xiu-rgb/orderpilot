import type { GovernanceNotice } from "@orderpilot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatDayTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ADMIN_NOTICES_KEY,
  markNoticeRead,
  useAdminNotices,
} from "./useAdminNotices";

/**
 * What the administrator's role gained, as the management approvers are told
 * it (#383, ADR 0067): who gave it, which permissions in the matrix's own
 * words, and when. Each approver marks a notice read for themselves. Drawn in
 * the bell for a session that decides approvals; nothing when there is none.
 */
export function AdminNotices() {
  const { t, i18n } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const headingId = useId();
  const query = useAdminNotices(true);
  const client = useQueryClient();
  const mark = useMutation({
    mutationFn: markNoticeRead,
    onSettled: () => client.invalidateQueries({ queryKey: ADMIN_NOTICES_KEY }),
  });

  if (query.isError) {
    return (
      <p className="text-sm text-muted-foreground">{t("notices.failed")}</p>
    );
  }
  const items = query.data?.data ?? [];
  if (items.length === 0) return null;
  const list = new Intl.ListFormat(i18n.language, {
    style: "long",
    type: "conjunction",
  });
  const sentence = (notice: GovernanceNotice) => {
    const permissions = list.format(
      notice.permissions.map((permission) => t(`permissions.${permission}`)),
    );
    return notice.fromRole
      ? t("notices.copied", {
          name: notice.actorName,
          from: tc(`roles.${notice.fromRole}`),
          permissions,
        })
      : t("notices.widened", { name: notice.actorName, permissions });
  };

  return (
    <section
      data-admin-notices=""
      aria-labelledby={headingId}
      className="shrink-0 space-y-1"
    >
      <h3 id={headingId} className="text-xs font-medium text-muted-foreground">
        {t("notices.heading")}
      </h3>
      <ul aria-label={t("notices.label")} className="divide-y">
        {items.map((notice) => {
          const text = sentence(notice);
          return (
            <li key={notice.id} className="space-y-0.5 py-1.5">
              <p
                className={cn(
                  "text-sm",
                  notice.read && "text-muted-foreground",
                )}
              >
                {text}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDayTime(notice.createdAt)}
                </span>
                {notice.read ? null : (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="pointer-coarse:h-11"
                    aria-label={t("notices.markReadFor", { text })}
                    disabled={mark.isPending}
                    onClick={() => {
                      mark.mutate(notice.id);
                    }}
                  >
                    {t("notices.markRead")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
