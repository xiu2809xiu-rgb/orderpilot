import { Link2, Link2Off } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ErrorPanel,
  RelativeTime,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useAuditViewerChain } from "@/lib/api/generated/endpoints/audit/audit";

/**
 * The chain check. It reads the whole trail, so it runs when asked, not on
 * every visit. Scheduling it and anchoring the latest hash outside the
 * database are area 4's later stories.
 */
export function ChainCheckCard() {
  const { t } = useTranslation("audit");
  const check = useAuditViewerChain({
    query: { enabled: false, staleTime: 0, gcTime: 0, retry: false },
  });
  const result = check.data?.data;

  return (
    <SectionCard
      title={t("chain.title")}
      description={t("chain.description")}
      actions={
        <Button
          variant="outline"
          disabled={check.isFetching}
          onClick={() => void check.refetch()}
        >
          {check.isFetching ? t("chain.checking") : t("chain.check")}
        </Button>
      }
    >
      <div aria-live="polite" className="space-y-s1">
        {check.isError ? (
          <ErrorPanel
            error={check.error}
            onRetry={() => void check.refetch()}
          />
        ) : null}
        {!result && !check.isError ? (
          <p className="text-sm text-muted-foreground">{t("chain.never")}</p>
        ) : null}
        {result?.ok ? (
          <>
            <StatusBadge tone="success">
              <Link2 className="size-3.5" aria-hidden="true" />
              {result.checked === 0
                ? t("chain.okEmpty")
                : t("chain.ok", { n: result.verifiedThrough ?? 0 })}
            </StatusBadge>
            <p className="text-sm text-muted-foreground">
              {t("chain.okDetail", { count: result.checked })}
            </p>
          </>
        ) : null}
        {result && !result.ok ? (
          <div role="alert" className="space-y-s1">
            <StatusBadge tone="danger">
              <Link2Off className="size-3.5" aria-hidden="true" />
              {t("chain.broken", { n: result.brokenAtSequence ?? 0 })}
            </StatusBadge>
            <p className="text-sm">
              {t("chain.brokenDetail", {
                problem: result.problem
                  ? t(`chain.problems.${result.problem}`)
                  : "",
                through: result.verifiedThrough ?? 0,
              })}
            </p>
          </div>
        ) : null}
        {result ? (
          <p className="text-xs text-muted-foreground">
            {t("chain.checkedAt")} <RelativeTime value={result.checkedAt} />
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
