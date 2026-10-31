import { useTranslation } from "react-i18next";
import { DataTable, SectionCard } from "@/components/common";
import { ApiError } from "@/lib/api/errors";
import { useAuditViewerList } from "@/lib/api/generated/endpoints/audit/audit";
import { AuditFilters } from "./AuditFilters";
import { useAuditColumns } from "./auditColumns";
import { toListRequest, useAuditQuery } from "./auditQuery";

/**
 * The audit log: P-12's data table over `GET /audit/events`. Paging and
 * filters are the server's. There is no export here (it is area 4's later
 * story), so the table is given no export options.
 */
export function AuditLogTable() {
  const { t } = useTranslation("audit");
  const { query, setQuery, openEvent } = useAuditQuery();
  const columns = useAuditColumns(openEvent);
  const { params, problem } = toListRequest(query);
  const list = useAuditViewerList(params, { query: { enabled: !problem } });

  const forbidden =
    list.error instanceof ApiError && list.error.code === "FORBIDDEN";
  const status = problem
    ? "ready"
    : list.isPending
      ? "loading"
      : forbidden
        ? "forbidden"
        : list.isError
          ? "error"
          : "ready";

  return (
    <SectionCard title={t("table.caption")}>
      <div className="space-y-s2">
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`filters.problems.${problem}`)}
          </p>
        ) : null}
        <DataTable
          tableId="audit-log"
          caption={t("table.caption")}
          columns={columns}
          rows={problem ? [] : (list.data?.data ?? [])}
          total={problem ? 0 : (list.data?.meta.total ?? 0)}
          query={query}
          onQueryChange={setQuery}
          rowKey={(row) => row.id}
          status={status}
          error={list.error}
          onRetry={() => void list.refetch()}
          filterSlot={({ filters, setFilter }) => (
            <AuditFilters filters={filters} setFilter={setFilter} />
          )}
          toggleFilters={[{ id: "refusals", label: t("filters.refusals") }]}
          empty={{
            title: t("table.emptyTitle"),
            description: t("table.emptyDescription"),
          }}
        />
      </div>
    </SectionCard>
  );
}
