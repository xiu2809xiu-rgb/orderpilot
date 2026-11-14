import { useTranslation } from "react-i18next";
import {
  DemoBadge,
  ErrorPanel,
  LoadingState,
  ScrollRegion,
  SectionCard,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOverviewClickstream } from "@/lib/api/generated/endpoints/monitoring/monitoring";
import { tracker, useConsent } from "./tracker";

/** What this browser has chosen, with the way to change it. */
function BrowserChoice() {
  const { t } = useTranslation("monitoring");
  const consent = useConsent();
  const key =
    consent === "granted"
      ? "allowed"
      : consent === "denied"
        ? "declined"
        : consent;
  return (
    <SectionCard title={t("clickstream.preference.title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{t(`clickstream.preference.${key}`)}</p>
        {consent === "blocked" ? null : consent === "granted" ? (
          <Button
            variant="outline"
            onClick={() => {
              tracker.deny();
            }}
          >
            {t("clickstream.preference.withdraw")}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              tracker.grant();
            }}
          >
            {t("clickstream.preference.enable")}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

/** Usage summary on mock data until Angelyn reads the ClickstreamEvent table (Sprints 13 to 15). */
export function ClickstreamTab() {
  const { t } = useTranslation("monitoring");
  const query = useOverviewClickstream();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  const { consentRate, topRoutes, byRole } = query.data.data;

  return (
    <div className="space-y-s3">
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge kind="mock" />
        <p className="text-sm text-muted-foreground">
          {t("clickstream.mockNote")}
        </p>
      </div>
      <BrowserChoice />
      <SectionCard
        title={t("clickstream.consent.title")}
        description={t("clickstream.consent.description")}
      >
        <p className="text-2xl font-semibold tabular-nums">
          {t("clickstream.consent.rate", { rate: consentRate })}
        </p>
      </SectionCard>
      <SectionCard
        title={t("clickstream.routes.title")}
        description={t("clickstream.routes.description")}
      >
        <ScrollRegion label={t("clickstream.routes.label")}>
          <Table aria-label={t("clickstream.routes.label")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("clickstream.routes.route")}</TableHead>
                <TableHead className="text-right">
                  {t("clickstream.routes.views")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topRoutes.map((row) => (
                <TableRow key={row.route}>
                  <TableCell>
                    <code className="text-xs">{row.route}</code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.views}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      </SectionCard>
      <SectionCard
        title={t("clickstream.roles.title")}
        description={t("clickstream.roles.description")}
      >
        <Table aria-label={t("clickstream.roles.label")}>
          <TableHeader>
            <TableRow>
              <TableHead>{t("clickstream.roles.role")}</TableHead>
              <TableHead className="text-right">
                {t("clickstream.roles.events")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byRole.map((row) => (
              <TableRow key={row.role}>
                <TableCell>{row.role}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.events}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
