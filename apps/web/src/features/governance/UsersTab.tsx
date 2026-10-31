import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  LoadingState,
  PermissionDenied,
  SectionCard,
  toast,
  StatusBadge,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getUsersListQueryKey,
  usersDisable,
  usersEnable,
  useUsersList,
} from "@/lib/api/generated/endpoints/users/users";
import { hasPermission, useSessionStore } from "@/stores/session";
import { RefusalPanel } from "./RefusalPanel";
import { UserHistoryDialog } from "./UserHistoryDialog";

/**
 * Users come from P-10's routes. They are disabled or enabled, never deleted:
 * the audit trail keeps pointing at a name.
 */
export function UsersTab() {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const canRead = hasPermission(session, "users.read");
  const canManage = hasPermission(session, "users.manage");
  const users = useUsersList(
    { pageSize: 100 },
    { query: { enabled: canRead } },
  );
  const change = useMutation({
    mutationFn: (v: { id: string; disable: boolean }) =>
      v.disable ? usersDisable(v.id) : usersEnable(v.id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: getUsersListQueryKey() }),
  });

  if (!canRead) {
    return <PermissionDenied description={t("users.forbiddenDescription")} />;
  }
  if (users.isPending) return <LoadingState />;
  if (users.isError) {
    return (
      <RefusalPanel error={users.error} onRetry={() => void users.refetch()} />
    );
  }
  const rows = users.data.data;

  return (
    <SectionCard title={t("users.title")} description={t("users.description")}>
      <div className="space-y-s2">
        {change.error ? <RefusalPanel error={change.error} /> : null}
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("users.emptyTitle")}
            description={t("users.emptyDescription")}
            onRetry={() => void users.refetch()}
          />
        ) : (
          <Table aria-label={t("users.tableLabel")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("users.name")}</TableHead>
                <TableHead>{t("users.email")}</TableHead>
                <TableHead>{t("users.role")}</TableHead>
                <TableHead>{t("users.status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("users.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{tc(`roles.${user.role}`)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={user.disabled ? "neutral" : "success"}>
                      {user.disabled ? t("users.disabled") : t("users.active")}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <UserHistoryDialog
                      userId={user.id}
                      name={user.displayName}
                    />
                    {canManage ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={change.isPending}
                        aria-label={t(
                          user.disabled
                            ? "users.enableFor"
                            : "users.disableFor",
                          { name: user.displayName },
                        )}
                        onClick={() => {
                          const disable = !user.disabled;
                          change.mutate(
                            { id: user.id, disable },
                            {
                              onSuccess: () =>
                                toast.done(
                                  t(
                                    disable
                                      ? "users.toast.disabled"
                                      : "users.toast.enabled",
                                    { name: user.displayName },
                                  ),
                                  {
                                    undo: async () => {
                                      await (disable
                                        ? usersEnable(user.id)
                                        : usersDisable(user.id));
                                      await queryClient.invalidateQueries({
                                        queryKey: getUsersListQueryKey(),
                                      });
                                    },
                                  },
                                ),
                              onError: () =>
                                toast.failed(t("users.toast.failed")),
                            },
                          );
                        }}
                      >
                        {user.disabled ? t("users.enable") : t("users.disable")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </SectionCard>
  );
}
