import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { SectionCard } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useWorkflowsOpenRules } from "@/lib/api/generated/endpoints/workflows/workflows";
import {
  HOME_FIRST_CELL,
  HomeTable,
  homeCell,
  type HomeColumn,
} from "./HomeTable";

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
    { id: "draft", label: t("rules.columns.draft") },
    { id: "action", label: t("needs.columns.action"), action: true },
  ];

  return (
    <SectionCard
      title={t("rules.title")}
      description={t("rules.description")}
      className="h-full"
    >
      <QueryBoundary query={query}>
        <HomeTable label={t("rules.title")} columns={columns}>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td className={HOME_FIRST_CELL}>{t(`rules.names.${rule.id}`)}</td>
              <td className={`${homeCell({})} min-w-64 whitespace-normal`}>
                {rule.value}
              </td>
              <td className={homeCell({ action: true })}>
                {rule.screen ? (
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
                )}
              </td>
            </tr>
          ))}
        </HomeTable>
      </QueryBoundary>
    </SectionCard>
  );
}
