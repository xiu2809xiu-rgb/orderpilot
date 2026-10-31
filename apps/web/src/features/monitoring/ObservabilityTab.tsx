import { useTranslation } from "react-i18next";
import {
  DemoBadge,
  ErrorPanel,
  LoadingState,
  PartialNotice,
  ScrollRegion,
  SectionCard,
  StatusBadge,
  type StatusTone,
} from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOverviewObservability } from "@/lib/api/generated/endpoints/monitoring/monitoring";

const STATUS_TONE: Record<string, StatusTone> = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
};

/** Service health and recent traces. Mock data until the real dashboards (Sprints 13 to 15). */
export function ObservabilityTab() {
  const { t } = useTranslation("monitoring");
  const query = useOverviewObservability();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const { services, recentTraces } = query.data.data;
  const degraded = services
    .filter((service) => service.status !== "healthy")
    .map((service) => service.name);

  return (
    <div className="space-y-s3">
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge kind="mock" />
        <p className="text-sm text-muted-foreground">
          {t("observability.mockNote")}
        </p>
      </div>
      {degraded.length > 0 ? (
        <PartialNotice
          description={t("observability.partial", {
            names: degraded.join(", "),
          })}
        />
      ) : null}
      <SectionCard
        title={t("observability.services.title")}
        description={t("observability.services.description")}
      >
        <ScrollRegion label={t("observability.services.label")}>
          <Table aria-label={t("observability.services.label")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("observability.services.name")}</TableHead>
                <TableHead>{t("observability.services.status")}</TableHead>
                <TableHead className="text-right">
                  {t("observability.services.p95")}
                </TableHead>
                <TableHead className="text-right">
                  {t("observability.services.errorRate")}
                </TableHead>
                <TableHead className="text-right">
                  {t("observability.services.rate")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.name}>
                  <TableCell>{service.name}</TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={STATUS_TONE[service.status] ?? "neutral"}
                    >
                      {t(`observability.status.${service.status}`)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {`${String(service.p95Ms)} ms`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {`${service.errorRate}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {service.requestsPerMinute}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      </SectionCard>
      <SectionCard
        title={t("observability.traces.title")}
        description={t("observability.traces.description")}
      >
        <ScrollRegion label={t("observability.traces.label")}>
          <Table aria-label={t("observability.traces.label")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("observability.traces.traceId")}</TableHead>
                <TableHead>{t("observability.traces.route")}</TableHead>
                <TableHead className="text-right">
                  {t("observability.traces.duration")}
                </TableHead>
                <TableHead className="text-right">
                  {t("observability.traces.status")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTraces.map((trace) => (
                <TableRow key={trace.traceId}>
                  <TableCell>
                    <code className="text-xs">{trace.traceId}</code>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{trace.route}</code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {`${String(trace.durationMs)} ms`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {trace.status}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      </SectionCard>
    </div>
  );
}
