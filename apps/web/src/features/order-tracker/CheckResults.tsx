import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CheckResult } from "@orderpilot/shared";
import {
  DemoBadge,
  EmptyState,
  SectionCard,
  StatusBadge,
} from "@/components/common";

/**
 * The check results on an order: pass or fail, what was expected, what was
 * found, the tolerance and the evidence. They are sample results; the rules
 * and tolerances are area 3's to write.
 */
export function CheckResults({ checks }: { checks: readonly CheckResult[] }) {
  const { t } = useTranslation("order-tracker");
  return (
    <SectionCard
      title={t("detail.checks.title")}
      description={t("detail.checks.description")}
      actions={<DemoBadge kind="mock" />}
    >
      {checks.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t("detail.checks.empty")} />
      ) : (
        <ul className="space-y-s2">
          {checks.map((check) => (
            <li key={check.id} className="space-y-1 rounded-lg border p-s2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={check.outcome === "pass" ? "success" : "danger"}
                >
                  {t(`detail.checks.${check.outcome}`)}
                </StatusBadge>
                <h3 className="font-medium">{check.ruleLabel}</h3>
              </div>
              <dl className="grid gap-x-s3 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.checks.expected")}
                  </dt>
                  <dd className="font-mono">{check.expected}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.checks.found")}
                  </dt>
                  <dd className="font-mono">{check.actual}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("detail.checks.tolerance")}
                  </dt>
                  <dd>
                    {check.tolerance.label}:{" "}
                    <span className="font-mono">{check.tolerance.value}</span>
                  </dd>
                </div>
              </dl>
              {check.evidence.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("detail.checks.evidence")}:{" "}
                  {check.evidence
                    .map(
                      (e) =>
                        `${e.documentType.replaceAll("_", " ").toLowerCase()}, ${e.location}`,
                    )
                    .join("; ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
