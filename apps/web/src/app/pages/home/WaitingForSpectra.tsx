import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { SectionCard } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useWorkflowsOpenRules } from "@/lib/api/generated/endpoints/workflows/workflows";
import { HomeTable, type HomeColumn } from "./HomeTable";

/**
 * The system admin's list: the business rules that stay configuration until
 * Spectra confirms them. A rule with no screen says so, and has no button.
 */
export function WaitingForSpectra() {
  const { t } = useTranslation("home");
  const query = useWorkflowsOpenRules();
  const rules = query.data?.data ?? [];
  const columns: HomeColumn[] = [
    { id: "rule", label: t("rules.columns.rule") },
    { id: "draft", label: t("rules.columns.draft"), wrap: true },
    { id: "action", label: t("needs.columns.action"), action: true },
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
              action: rule.screen ? (
                <Link
                  to={rule.screen}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                  aria-label={t("needs.actionOn", {
                    action: t("rules.open"),
                    what: t(`rules.names.${rule.id}`),
                  })}
                >
                  {t("rules.open")}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("rules.noScreen")}
                </span>
              ),
            },
          }))}
        />
      </QueryBoundary>
    </SectionCard>
  );
}
