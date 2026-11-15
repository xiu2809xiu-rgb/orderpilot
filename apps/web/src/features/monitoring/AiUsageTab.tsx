import { Link } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  ErrorPanel,
  LoadingState,
  PermissionDenied,
  RelativeTime,
  ScrollRegion,
  SectionCard,
  StatusBadge,
  type StatusTone,
} from "@/components/common";
import { GradientText } from "@/components/kit/GradientText";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/errors";
import { useAiUsageReport } from "@/lib/api/generated/endpoints/monitoring/monitoring";

const PAGE_SIZE = 10;

const STATUS_TONE: Record<string, StatusTone> = {
  ok: "success",
  error: "danger",
  refused: "warning",
  timeout: "warning",
};

const number = new Intl.NumberFormat("en");

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  /** A second figure of the same measure, under the first. */
  note?: string;
}) {
  return (
    <div className="dx-card flex flex-col gap-2 p-4">
      <dt className="fs-14 text-muted-foreground">{label}</dt>
      <dd className="fs-28 font-semibold tabular-nums">
        <GradientText>{value}</GradientText>
      </dd>
      {note ? <dd className="fs-14 text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

/** AI usage and cost, read from the real AiUsageRecord table. */
export function AiUsageTab() {
  const { t } = useTranslation("monitoring");
  const [page, setPage] = useState(1);
  const query = useAiUsageReport({ page, pageSize: PAGE_SIZE });

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return query.error instanceof ApiError &&
      query.error.code === "FORBIDDEN" ? (
      <PermissionDenied description={t("denied")} />
    ) : (
      <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
    );
  }

  const { summary, byFeature, records } = query.data.data;
  const { total } = query.data.meta;
  if (summary.calls === 0) {
    return (
      <EmptyState
        title={t("aiUsage.empty.title")}
        description={t("aiUsage.empty.description")}
        action={
          <Button variant="outline" asChild>
            <Link to="/governance">{t("aiUsage.empty.action")}</Link>
          </Button>
        }
      />
    );
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-s3">
      <dl className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t("aiUsage.tiles.calls")}
          value={number.format(summary.calls)}
        />
        <Tile
          label={t("aiUsage.tiles.tokens")}
          value={number.format(summary.inputTokens)}
          note={t("aiUsage.tiles.tokensOut", {
            out: number.format(summary.outputTokens),
          })}
        />
        <Tile label={t("aiUsage.tiles.cost")} value={`$${summary.costUsd}`} />
        <Tile
          label={t("aiUsage.tiles.failed")}
          value={number.format(summary.failedCalls)}
        />
      </dl>
      <SectionCard
        title={t("aiUsage.byFeature.title")}
        description={t("aiUsage.byFeature.description")}
      >
        <ScrollRegion
          label={t("aiUsage.byFeature.label")}
          className="rounded-none border-0 bg-transparent"
        >
          <Table className="dt-table" aria-label={t("aiUsage.byFeature.label")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("aiUsage.byFeature.feature")}</TableHead>
                <TableHead className="text-right">
                  {t("aiUsage.byFeature.calls")}
                </TableHead>
                <TableHead className="text-right">
                  {t("aiUsage.byFeature.cost")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byFeature.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell>{row.feature}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {number.format(row.calls)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.costUsd}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      </SectionCard>
      <SectionCard
        title={t("aiUsage.records.title")}
        description={t("aiUsage.records.description")}
      >
        <ScrollRegion
          label={t("aiUsage.records.label")}
          className="rounded-none border-0 bg-transparent"
        >
          <Table className="dt-table" aria-label={t("aiUsage.records.label")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("aiUsage.records.time")}</TableHead>
                <TableHead>{t("aiUsage.records.feature")}</TableHead>
                <TableHead>{t("aiUsage.records.model")}</TableHead>
                <TableHead className="text-right">
                  {t("aiUsage.records.tokens")}
                </TableHead>
                <TableHead className="text-right">
                  {t("aiUsage.records.cost")}
                </TableHead>
                <TableHead className="text-right">
                  {t("aiUsage.records.latency")}
                </TableHead>
                <TableHead>{t("aiUsage.records.status")}</TableHead>
                <TableHead>{t("aiUsage.records.trace")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <RelativeTime value={record.occurredAt} />
                  </TableCell>
                  <TableCell>{record.feature}</TableCell>
                  <TableCell>{`${record.provider} / ${record.model}`}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {`${number.format(record.inputTokens)} / ${number.format(record.outputTokens)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {record.costUsd}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {`${number.format(record.latencyMs)} ms`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={STATUS_TONE[record.status] ?? "neutral"}>
                      {t(`aiUsage.status.${record.status}`)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{record.traceId}</code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
        <nav
          aria-label={t("aiUsage.records.label")}
          className="mt-s2 flex items-center justify-between gap-2"
        >
          <Button
            variant="outline"
            className="pointer-coarse:h-11"
            disabled={page <= 1}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            {t("aiUsage.records.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("aiUsage.records.page", { page, pages })}
          </span>
          <Button
            variant="outline"
            className="pointer-coarse:h-11"
            disabled={page >= pages}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            {t("aiUsage.records.next")}
          </Button>
        </nav>
      </SectionCard>
    </div>
  );
}
