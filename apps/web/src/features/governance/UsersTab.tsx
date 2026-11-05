import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ROLES } from "@orderpilot/shared";
import {
  PermissionDenied,
  StatusBadge,
  toast,
  useUrlQuery,
  type DataTableColumn,
} from "@/components/common";
import {
  ListPage,
  type ListAction,
  type ListFilter,
} from "@/components/list-page";
import {
  getUsersListQueryKey,
  usersDisable,
  usersEnable,
  useUsersList,
} from "@/lib/api/generated/endpoints/users/users";
import type {
  UsersList200DataItem as UserRow,
  UsersListParams,
} from "@/lib/api/generated/model";
import { hasPermission, useSessionStore } from "@/stores/session";
import { RefusalPanel } from "./RefusalPanel";

const URL_FILTERS = ["active", "role"] as const;

/**
 * Users come from P-10's routes. They are disabled or enabled, never deleted:
 * the audit trail keeps pointing at a name. The record's history is the
 * operation log under the list.
 */
export function UsersTab() {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const [query, setQuery] = useUrlQuery(URL_FILTERS);
  const params: UsersListParams = {
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.filters.active === "true"
      ? { active: "true" as const }
      : query.filters.active === "false"
        ? { active: "false" as const }
        : {}),
    ...(typeof query.filters.role === "string"
      ? { role: query.filters.role as UsersListParams["role"] }
      : {}),
  };
  const canRead = hasPermission(session, "users.read");
  const users = useUsersList(params, {
    query: { enabled: canRead, placeholderData: (previous) => previous },
  });
  const change = useMutation({
    mutationFn: (v: { id: string; disable: boolean }) =>
      v.disable ? usersDisable(v.id) : usersEnable(v.id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: getUsersListQueryKey() }),
  });

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      {
        id: "displayName",
        header: t("users.name"),
        cell: (row) => row.displayName,
        exportValue: (row) => row.displayName,
        hideable: false,
      },
      {
        id: "email",
        header: t("users.email"),
        cell: (row) => row.email,
        exportValue: (row) => row.email,
      },
      {
        id: "role",
        header: t("users.role"),
        cell: (row) => tc(`roles.${row.role}`),
        exportValue: (row) => tc(`roles.${row.role}`),
      },
      {
        id: "status",
        header: t("users.status"),
        cell: (row) => (
          <StatusBadge tone={row.disabled ? "neutral" : "success"}>
            {row.disabled ? t("users.disabled") : t("users.active")}
          </StatusBadge>
        ),
        exportValue: (row) =>
          row.disabled ? t("users.disabled") : t("users.active"),
      },
    ],
    [t, tc],
  );

  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "role",
        label: t("users.role"),
        allLabel: t("users.allRoles"),
        options: ROLES.map((role) => ({
          value: role,
          label: tc(`roles.${role}`),
        })),
      },
      { id: "active", label: t("users.activeOnly"), kind: "toggle" },
    ],
    [t, tc],
  );

  const run = (rows: readonly UserRow[], disable: boolean) => {
    for (const user of rows) {
      change.mutate(
        { id: user.id, disable },
        {
          onSuccess: () =>
            toast.done(
              t(disable ? "users.toast.disabled" : "users.toast.enabled", {
                name: user.displayName,
              }),
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
          onError: () => toast.failed(t("users.toast.failed")),
        },
      );
    }
  };

  const actions: ListAction<UserRow>[] = [
    {
      id: "disable",
      kind: "disable",
      permission: "users.manage",
      label: t("users.disable"),
      enabledFor: (rows) =>
        rows.some((row) => row.disabled)
          ? t("users.alreadyDisabled")
          : undefined,
      onRun: (rows) => {
        run(rows, true);
      },
    },
    {
      id: "enable",
      kind: "batch",
      permission: "users.manage",
      label: t("users.enable"),
      enabledFor: (rows) =>
        rows.some((row) => !row.disabled)
          ? t("users.alreadyActive")
          : undefined,
      onRun: (rows) => {
        run(rows, false);
      },
    },
    { id: "export", kind: "export", permission: "users.read" },
    { id: "print", kind: "print", permission: "users.read" },
  ];

  if (!canRead) {
    return <PermissionDenied description={t("users.forbiddenDescription")} />;
  }
  return (
    <>
      {change.error ? <RefusalPanel error={change.error} /> : null}
      <ListPage
        tableId="governance-users"
        headingLevel={2}
        title={t("users.title")}
        description={t("users.description")}
        caption={t("users.tableLabel")}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={(row) => row.displayName}
        query={query}
        onQueryChange={setQuery}
        list={users}
        filters={filters}
        actions={actions}
        operationLog={{ entityType: "User", entityId: (row) => row.id }}
        empty={{
          title: t("users.emptyTitle"),
          description: t("users.emptyDescription"),
        }}
      />
    </>
  );
}
