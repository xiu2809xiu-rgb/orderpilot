import {
  INBOX_ROLES,
  apiPath,
  workflowReminderSchema,
} from "@orderpilot/shared";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/instance";
import { formatDay } from "@/lib/format";
import { useSessionStore } from "@/stores/session";
import { Popover, PopoverContent, PopoverTrigger } from "./overlays/popover";

const NEXT = 5;

const remindersSchema = z.object({
  data: z.array(workflowReminderSchema),
  meta: z.object({ total: z.number() }),
});

// The bell sits in the entry bundle. The generated workflows client would pull
// every workflow command in with it, so it asks through the plain API client.
async function nextReminders(signal: AbortSignal) {
  const body = await apiClient.request<unknown>({
    method: "GET",
    url: apiPath(`/workflows/reminders?pageSize=${String(NEXT)}`),
    signal,
  });
  return remindersSchema.parse(body);
}

/** The role's reminders: a count on the bell and the next five in its popover. */
export function Notifications() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const role = useSessionStore((state) => state.session?.user.role);
  const hasInbox = INBOX_ROLES.some((inbox) => inbox === role);
  const reminders = useQuery({
    queryKey: ["bell-reminders"],
    queryFn: ({ signal }) => nextReminders(signal),
    enabled: hasInbox,
  });
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
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col gap-s1"
      >
        <h2 className="shrink-0 text-sm font-medium">
          {t("notifications.title")}
        </h2>
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
            <ul className="min-h-0 divide-y overflow-y-auto">
              {reminders.data?.data.map((reminder) => (
                <li key={reminder.id}>
                  <Link
                    to={`/workflows/orders/${reminder.orderNo}`}
                    onClick={close}
                    className="block rounded-sm py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
              className="inline-block shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("notifications.seeAll", { count: total })}
            </Link>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
