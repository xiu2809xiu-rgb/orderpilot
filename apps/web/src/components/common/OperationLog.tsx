import { History } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DemoBadge } from "./DemoBadge";
import { RelativeTime } from "./RelativeTime";
import { ScrollRegion } from "./ScrollRegion";
import { SectionCard } from "./SectionCard";
import { EmptyState, LoadingState } from "./states";

export interface OperationLogRow {
  id: string;
  /** ISO time of the change. */
  at: string;
  user: string;
  /** Left out where the reader may not see it: the record-scoped log never has one. */
  ip?: string;
  /** What changed, in words: "Changed the unit price from 4.20 to 4.35". */
  change: string;
}

interface OperationLogProps {
  rows: readonly OperationLogRow[];
  loading?: boolean;
  /** True while the rows are demo data: shows "Synthetic demo data". */
  demo?: boolean;
  /** Usually an `AuditLink` to the full trail. */
  action?: ReactNode;
  /** A fixed "now", for tests and screenshots. */
  now?: Date;
  /** False leaves out the IP address column, for readers who may not see it. */
  showIp?: boolean;
  /** Names the record, such as "Operation log: SO-10001". */
  title?: string;
  /** Under the rows, such as "The 10 newest of 23". */
  footer?: ReactNode;
}

/**
 * The foot of every detail page: time, user, IP and what changed. It takes
 * its rows as props, so F-2 can feed it from the audit trail, and the list
 * page from the record-scoped log, which has no IP address.
 */
export function OperationLog({
  rows,
  loading,
  demo,
  action,
  now,
  showIp = true,
  title,
  footer,
}: OperationLogProps) {
  const { t } = useTranslation("components");
  return (
    <SectionCard
      title={title ?? t("log.title")}
      description={t("log.description")}
      actions={
        <>
          {demo ? <DemoBadge kind="synthetic" /> : null}
          {action}
        </>
      }
    >
      {loading ? (
        <LoadingState lines={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("log.empty")}
          description={t("log.emptyHint")}
        />
      ) : (
        <ScrollRegion label={t("log.region")}>
          <Table className="max-md:block">
            <TableHeader className="max-md:sr-only">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">{t("log.time")}</TableHead>
                <TableHead scope="col">{t("log.user")}</TableHead>
                {showIp ? (
                  <TableHead scope="col">{t("log.ip")}</TableHead>
                ) : null}
                <TableHead scope="col">{t("log.change")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="max-md:block">
              {rows.map((row) => (
                // Below 768 px each entry stacks as time, user, change: a table
                // column would wrap the user name onto four lines.
                <TableRow
                  key={row.id}
                  className="max-md:flex max-md:flex-col max-md:gap-0.5 max-md:px-3 max-md:py-2"
                >
                  <TableCell className="whitespace-nowrap max-md:px-0 max-md:py-0 max-md:text-xs max-md:text-muted-foreground">
                    <RelativeTime value={row.at} now={now} />
                  </TableCell>
                  <TableCell className="max-md:px-0 max-md:py-0 max-md:font-medium">
                    {row.user}
                  </TableCell>
                  {showIp ? (
                    <TableCell className="font-mono text-xs">
                      {row.ip ?? "-"}
                    </TableCell>
                  ) : null}
                  <TableCell className="min-w-[16rem] whitespace-normal max-md:min-w-0 max-md:px-0 max-md:py-0">
                    {row.change}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      )}
      {footer}
    </SectionCard>
  );
}
