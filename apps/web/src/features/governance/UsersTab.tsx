import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import {
  EmptyState,
  FilterChips,
  LoadingState,
  PermissionDenied,
  ScrollRegion,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/errors";
import { useUsersList } from "@/lib/api/generated/endpoints/users/users";
import { hasPermission, useSessionStore } from "@/stores/session";
import { RefusalPanel } from "./RefusalPanel";
import { useUserToggle } from "./useUserToggle";
import { UserRowActions } from "./UserRowActions";

/**
 * Users come from P-10's routes. They are disabled or enabled, never deleted:
 * the audit trail keeps pointing at a name.
 */
export function UsersTab() {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const canRead = hasPermission(session, "users.read");
  const canManage = hasPermission(session, "users.manage");
  const [params, setParams] = useSearchParams();
  const activeOnly = params.get("active") === "true";
  const users = useUsersList(
    { pageSize: 100, ...(activeOnly ? { active: "true" as const } : {}) },
    { query: { enabled: canRead } },
  );
  const chips = activeOnly
    ? [{ id: "active", label: t("users.activeOnly") }]
    : [];
  const { change, toggle } = useUserToggle();
  // An access refusal is drawn above the table; any other refusal is the toast's.
  const refused =
    change.error instanceof ApiError && change.error.code === "FORBIDDEN";

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
        {refused ? <RefusalPanel error={change.error} /> : null}
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("users.emptyTitle")}
            description={t("users.emptyDescription")}
            onRetry={() => void users.refetch()}
          />
        ) : (
          <ScrollRegion
            label={t("users.listLabel")}
            className="rounded-none border-0 bg-transparent"
          >
            <Table className="dt-table" aria-label={t("users.tableLabel")}>
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
                    <TableCell>
                      {user.displayName}
                      {user.id === session?.user.id ? (
                        <Badge variant="outline" className="ms-2">
                          {t("users.you")}
                        </Badge>
                      ) : null}
                    </TableCell>
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
                      <UserRowActions
                        user={user}
                        canManage={canManage}
                        self={user.id === session?.user.id}
                        busy={change.isPending}
                        onToggle={toggle}
                      />
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
