import { CircleCheck, CircleX, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/kit/StatusChip";
import { Section } from "@/components/parts/Section";
import { Button } from "@/components/ui/button";
import { useSystemCheckStatuses } from "@/lib/api/generated/endpoints/system/system";
import { HomeQuery } from "./HomeQuery";
import { RowSkeletons } from "./RowSkeletons";

/**
 * The system administrator's first question on arrival: is everything up? Each
 * readiness check runs when the page opens, and again on request. The reason a
 * check failed stays in the server's log, so this shows up or down only. It
 * stands where the other roles have their shortcuts, because the administrator's
 * menu already holds its places.
 */
export function SystemHealth({ className }: { className?: string }) {
  const { t } = useTranslation("home");
  const query = useSystemCheckStatuses();
  const checks = query.data?.data ?? [];
  const down = checks.filter((check) => check.status === "down").length;
  const intro = query.isSuccess
    ? down === 0
      ? t("health.allUp")
      : t("health.someDown", { count: down })
    : t("health.description");

  return (
    <Section title={t("health.title")} intro={intro} className={className}>
      <HomeQuery query={query} loading={<RowSkeletons rows={3} />}>
        <ul className="flex flex-col divide-y divide-border">
          {checks.map((check) => (
            <li
              key={check.name}
              className="fs-14 flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                {t(`health.names.${check.name}`, { defaultValue: check.name })}
              </span>
              {check.status === "up" ? (
                <StatusChip kind="success" icon={CircleCheck}>
                  {t("health.up", { ms: check.durationMs })}
                </StatusChip>
              ) : (
                <StatusChip kind="destructive" icon={CircleX}>
                  {t("health.down")}
                </StatusChip>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 pointer-coarse:min-h-11"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          <RotateCw
            aria-hidden="true"
            className={query.isFetching ? "motion-safe:animate-spin" : ""}
          />
          {t("health.again")}
        </Button>
      </HomeQuery>
    </Section>
  );
}
