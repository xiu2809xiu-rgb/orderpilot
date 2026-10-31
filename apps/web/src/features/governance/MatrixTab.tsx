import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  LoadingState,
  PermissionDenied,
  SectionCard,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  getMatrixReadQueryKey,
  matrixCopy,
  matrixSetDataScope,
  matrixSetPermission,
  useMatrixRead,
} from "@/lib/api/generated/endpoints/governance/governance";
import type { MatrixCopyBody } from "@/lib/api/generated/model";
import { hasPermission, useSessionStore } from "@/stores/session";
import { CopyRoleDialog } from "./CopyRoleDialog";
import { MatrixTable } from "./MatrixTable";
import { RefusalPanel } from "./RefusalPanel";

type Role = MatrixCopyBody["fromRole"];
type Permission = Parameters<typeof matrixSetPermission>[1];
type Scope = Parameters<typeof matrixSetDataScope>[1]["dataScope"];

/** The live matrix: reads the RolePermission table and writes each change back. */
export function MatrixTab() {
  const { t } = useTranslation("governance");
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const canManage = hasPermission(session, "roles.manage");
  const matrix = useMatrixRead();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getMatrixReadQueryKey() });

  const toggle = useMutation({
    mutationFn: (v: { role: Role; permission: Permission; granted: boolean }) =>
      matrixSetPermission(v.role, v.permission, { granted: v.granted }),
    onSettled: refresh,
  });
  const scope = useMutation({
    mutationFn: (v: { role: Role; dataScope: Scope }) =>
      matrixSetDataScope(v.role, { dataScope: v.dataScope }),
    onSettled: refresh,
  });
  const copy = useMutation({
    mutationFn: (body: MatrixCopyBody) => matrixCopy(body),
    onSettled: refresh,
  });
  const busy = toggle.isPending || scope.isPending || copy.isPending;
  const failure = toggle.error ?? scope.error ?? copy.error;

  if (matrix.isPending) return <LoadingState />;
  if (matrix.isError) {
    return (
      <RefusalPanel
        error={matrix.error}
        onRetry={() => void matrix.refetch()}
      />
    );
  }
  const data = matrix.data.data;
  if (data.roles.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("matrix.emptyTitle")}
        description={t("matrix.emptyDescription")}
        action={
          <Button variant="outline" onClick={() => void matrix.refetch()}>
            {t("matrix.emptyAction")}
          </Button>
        }
      />
    );
  }

  return (
    <SectionCard
      title={t("matrix.title")}
      description={t("matrix.description")}
      actions={
        canManage ? (
          <CopyRoleDialog
            roles={data.roles.map((access) => access.role)}
            busy={busy}
            onCopy={(body) => copy.mutateAsync(body)}
          />
        ) : null
      }
    >
      <div className="space-y-s2">
        {canManage ? null : (
          <PermissionDenied description={t("matrix.readOnly")} />
        )}
        {failure ? <RefusalPanel error={failure} /> : null}
        <p role="status" className="sr-only">
          {busy ? t("matrix.saving") : ""}
        </p>
        <MatrixTable
          matrix={data}
          canManage={canManage}
          busy={busy}
          onToggle={(role, permission, granted) => {
            toggle.mutate({ role, permission, granted });
          }}
          onScope={(role, dataScope) => {
            scope.mutate({ role, dataScope });
          }}
        />
      </div>
    </SectionCard>
  );
}
