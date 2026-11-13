import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import {
  EmptyState,
  FilterChips,
  LoadingState,
  PermissionDenied,
  ScrollRegion,
  SectionCard,
  toast,
  StatusBadge,
} from "@/components/common";
import { SearchBox } from "@/components/common/data-table/SearchBox";
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
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const activeOnly = params.get("active") === "true";
  const users = useUsersList(
    { pageSize: 100, ...(activeOnly ? { active: "true" as const } : {}) },
    { query: { enabled: canRead } },
  );
  const chips = activeOnly
    ? [{ id: "active", label: t("users.activeOnly") }]
    : [];
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
  const needle = search.trim().toLowerCase();
  // A short list of people, so it is searched here rather than on the server.
  const rows = users.data.data.filter(
    (user) =>
      needle === "" ||
      [user.displayName, user.email, tc(`roles.${user.role}`)].some((text) =>
        text.toLowerCase().includes(needle),
      ),
  );
  const me = session?.user.id;

  return (
    <SectionCard title={t("users.title")} description={t("users.description")}>
      <div className="space-y-s2">
        <SearchBox
          value={search}
          onSearch={setSearch}
          debounceMs={0}
          label={t("users.search")}
        />
        <FilterChips
          chips={chips}
          filters={activeOnly ? { active: true } : {}}
          onChange={() => {
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.delete("active");
                return next;
              },
              { replace: true },
            );
          }}
        />
        {change.error ? <RefusalPanel error={change.error} /> : null}
        {rows.length === 0 && needle !== "" ? (
          <EmptyState
            icon={Users}
            title={t("users.noMatchTitle")}
            description={t("users.noMatchDescription", { search })}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("users.emptyTitle")}
            description={t("users.emptyDescription")}
            onRetry={() => void users.refetch()}
          />
        ) : (
          <ScrollRegion
            label={t("users.tableLabel")}
            className="rounded-none border-0 bg-transparent"
          >
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
                        {user.disabled
                          ? t("users.disabled")
                          : t("users.active")}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="py-1">
                      <div className="flex items-center justify-end gap-1">
                        <UserHistoryDialog
                          userId={user.id}
                          name={user.displayName}
                        />
                        {user.id === me ? (
                          // The server refuses to disable your own account, so no button offers it.
                          <span className="px-2 text-xs text-muted-foreground">
                            {t("users.you")}
                          </span>
                        ) : canManage ? (
                          <Button
                            variant="outline"
                            size="xs"
                            aria-disabled={change.isPending}
                            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                            aria-label={t(
                              user.disabled
                                ? "users.enableFor"
                                : "users.disableFor",
                              { name: user.displayName },
                            )}
                            onClick={() => {
                              // aria-disabled, not disabled: a disabled button drops the keyboard's focus.
                              if (change.isPending) return;
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
                            {user.disabled
                              ? t("users.enable")
                              : t("users.disable")}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollRegion>
        )}
      </div>
    </SectionCard>
  );
}
