import { INBOX_ROLES } from "@orderpilot/shared";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkflowsMyReminders } from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatDay } from "@/lib/format";
import { useSessionStore } from "@/stores/session";

const NEXT = 5;

/** The role's reminders: a count on the bell and the next five in its popover. */
export function Notifications() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const role = useSessionStore((state) => state.session?.user.role);
  const hasInbox = INBOX_ROLES.some((inbox) => inbox === role);
  const reminders = useWorkflowsMyReminders(
    { pageSize: NEXT },
    { query: { enabled: hasInbox } },
  );
  const total = reminders.data?.meta.total ?? 0;
  const shown = total > 99 ? "99+" : String(total);
  const close = () => {
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            total > 0
              ? t("notifications.titleCount", { count: total, shown })
              : t("notifications.title")
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {total > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-xs leading-4 font-medium text-primary-foreground tabular-nums"
            >
              {shown}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-s1">
        <h2 className="text-sm font-medium">{t("notifications.title")}</h2>
        {!hasInbox ? (
          <p className="text-sm text-muted-foreground">
            {t("notifications.noInbox")}
          </p>
        ) : reminders.isError ? (
          <p className="text-sm text-muted-foreground">
            {t("notifications.failed")}
          </p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {reminders.isPending
              ? t("shell.loading")
              : t("notifications.empty")}
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {reminders.data?.data.map((reminder) => (
                <li key={reminder.id}>
                  <Link
                    to={`/workflows/orders/${reminder.orderNo}`}
                    onClick={close}
                    className="block rounded-sm py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="block text-sm">{reminder.message}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {t("notifications.due", {
                        date: formatDay(reminder.dueAt),
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/workflows/reminders"
              onClick={close}
              className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("notifications.seeAll", { count: total })}
            </Link>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
