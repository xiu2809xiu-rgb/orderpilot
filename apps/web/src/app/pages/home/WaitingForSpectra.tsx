import { useTranslation } from "react-i18next";
import { SectionCard, StatusBadge } from "@/components/common";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useWorkflowsOpenRules } from "@/lib/api/generated/endpoints/workflows/workflows";
import { HomeTable, type HomeColumn } from "./HomeTable";

/**
 * The system admin's list of business rules: what Spectra settled at the
 * briefing, and the drafts still waiting for its answer. Each stays a setting.
 */
export function WaitingForSpectra() {
  const { t } = useTranslation("home");
  const query = useWorkflowsOpenRules();
  const rules = query.data?.data ?? [];
  const columns: HomeColumn[] = [
    { id: "rule", label: t("rules.columns.rule") },
    { id: "draft", label: t("rules.columns.draft"), wrap: true },
    { id: "status", label: t("rules.columns.status"), single: true },
  ];

  return (
    <SectionCard title={t("rules.title")} description={t("rules.description")}>
      <QueryBoundary query={query}>
        <HomeTable
          label={t("rules.table")}
          columns={columns}
          rows={rules.map((rule) => ({
            id: rule.id,
            cells: {
              rule: t(`rules.names.${rule.id}`),
              draft: rule.value,
              status: (
                <StatusBadge
                  tone={rule.status === "confirmed" ? "success" : "warning"}
                >
                  {t(`rules.status.${rule.status}`)}
                </StatusBadge>
              ),
            },
          }))}
        />
      </QueryBoundary>
    </SectionCard>
  );
}
