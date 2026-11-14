import { EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  ClassificationBadge,
  DemoBadge,
  EmptyState,
  LoadingState,
  MaskedValue,
  ScrollRegion,
  SectionCard,
} from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePolicyMaskingSample } from "@/lib/api/generated/endpoints/governance/governance";
import { useSessionStore } from "@/stores/session";
import { RefusalPanel } from "./RefusalPanel";

/** Where the note's row sits on the matrix. The `q` finds it once the matrix can search. */
const NOTE_ROW = "/governance?tab=matrix&q=masking.customerNote";

/**
 * One neutral sample rule, applied on the server. The note arrives as null for
 * a role the rule does not list, so there is nothing to read in the browser.
 * Who the rule lists is a row of the matrix, so the sample is read again each
 * time this tab opens, in case the matrix changed meanwhile.
 */
export function MaskingTab() {
  const { t } = useTranslation("governance");
  const { t: tc } = useTranslation();
  const { t: tm } = useTranslation("components");
  const role = useSessionStore((state) => state.session?.user.role);
  const sample = usePolicyMaskingSample({ query: { staleTime: 0 } });

  if (sample.isPending) return <LoadingState />;
  if (sample.isError) {
    return (
      <RefusalPanel
        error={sample.error}
        onRetry={() => void sample.refetch()}
      />
    );
  }
  const { rules, records } = sample.data.data;

  return (
    <div className="space-y-s3">
      <SectionCard
        title={t("masking.title")}
        description={t("masking.description")}
        actions={<DemoBadge kind="synthetic" />}
      >
        <p className="mb-s2 text-sm text-muted-foreground">
          {t("masking.matrixHint")}{" "}
          {/* Underlined, not only on hover: inside a sentence, colour alone would not mark it as a link (WCAG 1.4.1). */}
          <Link
            to={NOTE_ROW}
            className="text-primary underline underline-offset-4"
          >
            {t("masking.openMatrix")}
          </Link>
        </p>
        <ScrollRegion
          label={t("masking.rulesLabel")}
          className="rounded-none border-0 bg-transparent"
        >
          <Table className="dt-table" aria-label={t("masking.rulesLabel")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("masking.field")}</TableHead>
                <TableHead>{t("masking.classification")}</TableHead>
                <TableHead>{t("masking.visibleTo")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.field}>
                  <TableCell>
                    {rule.label}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {rule.field}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={rule.classification} />
                  </TableCell>
                  <TableCell>
                    {rule.visibleTo.map((r) => tc(`roles.${r}`)).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollRegion>
      </SectionCard>
      <SectionCard
        title={t("masking.recordsLabel")}
        description={
          role ? t("masking.viewing", { role: tc(`roles.${role}`) }) : undefined
        }
      >
        {records.length === 0 ? (
          <EmptyState
            icon={EyeOff}
            title={t("masking.emptyTitle")}
            description={t("masking.emptyDescription")}
            onRetry={() => void sample.refetch()}
          />
        ) : (
          <ScrollRegion
            label={t("masking.recordsTableLabel")}
            className="rounded-none border-0 bg-transparent"
          >
            <Table className="dt-table" aria-label={t("masking.recordsLabel")}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("masking.customer")}</TableHead>
                  <TableHead>{t("masking.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.customerNo}>
                    <TableCell>
                      {record.customerName}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {record.customerNo}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex flex-wrap items-center gap-x-2">
                        <MaskedValue
                          masked={record.note.masked}
                          value={record.note.value ?? undefined}
                          reason={record.note.reason ?? "role"}
                          visibleTo={rules[0]?.visibleTo
                            .map((r) => tc(`roles.${r}`))
                            .join(", ")}
                        />
                        {record.note.masked ? (
                          <span className="text-xs text-muted-foreground">
                            {tm(
                              `masked.reasons.${record.note.reason ?? "role"}`,
                            )}
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollRegion>
        )}
      </SectionCard>
    </div>
  );
}
