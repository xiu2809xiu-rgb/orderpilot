import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EntityOperationLog } from "@/features/audit/EntityOperationLog";
import { hasPermission, useSessionStore } from "@/stores/session";

/**
 * The change history of one user, from the audit trail: the operation log
 * under a record (P-12's component, fed by F-2). It shows only to roles that
 * may read the audit log.
 */
export function UserHistoryDialog({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const { t } = useTranslation("governance");
  const allowed = useSessionStore((state) =>
    hasPermission(state.session, "audit.read"),
  );
  if (!allowed) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("users.historyFor", { name })}
        >
          <History aria-hidden="true" />
          {t("users.history")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("users.historyTitle", { name })}</DialogTitle>
          <DialogDescription>{t("users.historyDescription")}</DialogDescription>
        </DialogHeader>
        <EntityOperationLog
          entityType="User"
          entityId={userId}
          subject={name}
        />
      </DialogContent>
    </Dialog>
  );
}
