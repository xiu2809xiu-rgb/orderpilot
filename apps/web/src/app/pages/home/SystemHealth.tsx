import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionCard, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useSystemCheckStatuses } from "@/lib/api/generated/endpoints/system/system";

/**
 * The system admin's first question on arrival: is everything up? Each
 * readiness check runs when the page opens, and again on request. The reason a
 * check failed stays in the server's log, so this shows up or down only.
 */
export function SystemHealth() {
  const { t } = useTranslation("home");
  const query = useSystemCheckStatuses();
  const checks = query.data?.data ?? [];
  const down = checks.filter((check) => check.status === "down").length;

  return (
    <SectionCard
      title={t("health.title")}
      description={
        query.isSuccess
          ? down === 0
            ? t("health.allUp")
            : t("health.someDown", { count: down })
          : t("health.description")
      }
    >
      <QueryBoundary query={query}>
        <ul className="divide-y divide-border">
          {checks.map((check) => (
            <li
              key={check.name}
              className="flex items-center justify-between gap-2 py-2"
            >
              <span className="text-sm">
                {t(`health.names.${check.name}`, { defaultValue: check.name })}
              </span>
              <StatusBadge tone={check.status === "up" ? "success" : "danger"}>
                {check.status === "up"
                  ? t("health.up", { ms: check.durationMs })
                  : t("health.down")}
              </StatusBadge>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-s1"
          onClick={() => {
            void query.refetch();
          }}
          disabled={query.isFetching}
        >
          <RotateCw
            aria-hidden="true"
            className={query.isFetching ? "motion-safe:animate-spin" : ""}
          />
          {t("health.again")}
        </Button>
      </QueryBoundary>
    </SectionCard>
  );
}
