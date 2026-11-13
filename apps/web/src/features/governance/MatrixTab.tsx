import { SearchX, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  LoadingState,
  PartialNotice,
  PermissionDenied,
  SectionCard,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMatrixRead } from "@/lib/api/generated/endpoints/governance/governance";
import { hasPermission, useSessionStore } from "@/stores/session";
import { CopyRoleDialog } from "./CopyRoleDialog";
import { MatrixFilterBar } from "./MatrixFilterBar";
import { MatrixTable } from "./MatrixTable";
import { NO_MATRIX_FILTERS, filterMatrix } from "./matrixFilter";
import { RefusalPanel } from "./RefusalPanel";
import { useMatrixChanges } from "./useMatrixChanges";
import { useMatrixFilters } from "./useMatrixFilters";

/** The live matrix: reads the RolePermission table and writes each change back. */
export function MatrixTab() {
  const { t } = useTranslation("governance");
  const session = useSessionStore((state) => state.session);
  const canManage = hasPermission(session, "roles.manage");
  const matrix = useMatrixRead();
  const { busy, failure, setPermission, setDataScope, copyRole } =
    useMatrixChanges();
  const { filters, setFilters } = useMatrixFilters();

  if (matrix.isPending) return <LoadingState />;
  if (matrix.isError && !matrix.data) {
    return (
      <RefusalPanel
        error={matrix.error}
        onRetry={() => void matrix.refetch()}
      />
    );
  }
  const data = matrix.data.data;
  const visible = filterMatrix(data, filters, (permission) =>
    t(`permissions.${permission}`),
  );
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
            onCopy={copyRole}
          />
        ) : null
      }
    >
      <div className="space-y-s2">
        {canManage ? null : (
          <PermissionDenied description={t("matrix.readOnly")} />
        )}
        {matrix.isError ? (
          <PartialNotice onRetry={() => void matrix.refetch()} />
        ) : null}
        {failure ? <RefusalPanel error={failure} /> : null}
        <p role="status" className="sr-only">
          {busy ? t("matrix.saving") : ""}
        </p>
        <MatrixFilterBar
          matrix={data}
          filters={filters}
          shown={visible.matrix.permissions.length}
          onChange={setFilters}
        />
        {visible.matrix.permissions.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("matrix.filter.noMatchTitle")}
            description={t("matrix.filter.noMatchDescription")}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setFilters(NO_MATRIX_FILTERS);
                }}
              >
                {t("matrix.filter.clear")}
              </Button>
            }
          />
        ) : (
          <MatrixTable
            matrix={visible.matrix}
            showDataScope={visible.showDataScope}
            canManage={canManage}
            busy={busy}
            onToggle={setPermission}
            onScope={(role, dataScope) => {
              setDataScope(
                role,
                dataScope,
                data.roles.find((access) => access.role === role)?.dataScope,
              );
            }}
          />
        )}
      </div>
    </SectionCard>
  );
}
