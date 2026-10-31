import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Empty until the workflow area sends reminders. No badge: there is no count. */
export function Notifications() {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications.title")}
        >
          <Bell className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <h2 className="text-sm font-medium">{t("notifications.title")}</h2>
        <div className="mt-s2 rounded-lg bg-muted p-s2 text-center">
          <p className="text-sm font-medium">{t("notifications.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("notifications.emptyHint")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
