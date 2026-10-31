import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClassificationBadge,
  CLASSIFICATIONS,
  EmptyState,
  LoadingState,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  policyCheckAiDestination,
  usePolicyAiDestinations,
} from "@/lib/api/generated/endpoints/governance/governance";
import type { PolicyCheckAiDestinationBody } from "@/lib/api/generated/model";
import { RefusalPanel } from "./RefusalPanel";

type Provider = PolicyCheckAiDestinationBody["provider"];
type Origin = PolicyCheckAiDestinationBody["origin"];
type Classification = PolicyCheckAiDestinationBody["classification"];

const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** What may go to which provider, and a request to try against the rule. */
export function AiTab() {
  const { t } = useTranslation("governance");
  const rules = usePolicyAiDestinations();
  const [provider, setProvider] = useState<Provider>("mock");
  const [origin, setOrigin] = useState<Origin>("real");
  const [classification, setClassification] =
    useState<Classification>("internal");
  const check = useMutation({
    mutationFn: () =>
      policyCheckAiDestination({ provider, origin, classification }),
  });

  if (rules.isPending) return <LoadingState />;
  if (rules.isError) {
    return (
      <RefusalPanel error={rules.error} onRetry={() => void rules.refetch()} />
    );
  }
  const list = rules.data.data;
  const decision = check.data?.data;

  return (
    <div className="space-y-s3">
      <SectionCard title={t("ai.title")} description={t("ai.description")}>
        {list.length === 0 ? (
          <EmptyState
            title={t("ai.emptyTitle")}
            description={t("ai.emptyDescription")}
          />
        ) : (
          <Table aria-label={t("ai.rulesLabel")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("ai.provider")}</TableHead>
                <TableHead>{t("ai.origins")}</TableHead>
                <TableHead>{t("ai.classifications")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((rule) => (
                <TableRow key={rule.provider}>
                  <TableCell>{t(`ai.providers.${rule.provider}`)}</TableCell>
                  <TableCell>
                    {rule.origins.length === 0
                      ? t("ai.none")
                      : rule.origins.map((o) => t(`ai.origin.${o}`)).join(", ")}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {rule.classifications.length === 0
                        ? t("ai.none")
                        : rule.classifications.map((level) => (
                            <ClassificationBadge key={level} level={level} />
                          ))}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
      <SectionCard title={t("ai.checkTitle")}>
        <form
          className="grid items-end gap-s2 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            check.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="ai-provider">{t("ai.provider")}</Label>
            <select
              id="ai-provider"
              className={SELECT}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as Provider);
              }}
            >
              {list.map((rule) => (
                <option key={rule.provider} value={rule.provider}>
                  {t(`ai.providers.${rule.provider}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-origin">{t("ai.origins")}</Label>
            <select
              id="ai-origin"
              className={SELECT}
              value={origin}
              onChange={(e) => {
                setOrigin(e.target.value as Origin);
              }}
            >
              {(["synthetic", "real"] as const).map((o) => (
                <option key={o} value={o}>
                  {t(`ai.origin.${o}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-class">{t("ai.classifications")}</Label>
            <select
              id="ai-class"
              className={SELECT}
              value={classification}
              onChange={(e) => {
                setClassification(e.target.value as Classification);
              }}
            >
              {CLASSIFICATIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={check.isPending}>
            {check.isPending ? t("ai.checking") : t("ai.check")}
          </Button>
        </form>
        <div role="status" className="pt-s2">
          {decision ? (
            <p className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={decision.allowed ? "success" : "danger"}>
                {decision.allowed ? t("ai.allowed") : t("ai.refused")}
              </StatusBadge>
              <span className="text-muted-foreground">{decision.reason}</span>
              <code className="text-xs">
                {t("ai.reasonLabel", { rule: decision.rule })}
              </code>
            </p>
          ) : null}
        </div>
        {check.isError ? <RefusalPanel error={check.error} /> : null}
      </SectionCard>
    </div>
  );
}
