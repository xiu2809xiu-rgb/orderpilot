import type { SalesOrderDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { ErrorPanel, PermissionDenied } from "@/components/common";
import { isForbidden } from "@/lib/query-status";
import { hasPermission, useSessionStore } from "@/stores/session";
import { ComparePicker } from "./ComparePicker";
import { PoDifferences } from "./PoDifferences";
import { usePoVersions } from "./usePoVersions";
import { VersionList } from "./VersionList";
import { VersionsLoading } from "./VersionsLoading";
import { whoHasIt } from "./versionsModel";

/** The PO versions of a submitted order: the list, the comparison, and who was told. */
export function SubmittedVersions({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const { orderNo, currencyCode } = detail;
  const mayEdit = useSessionStore((state) =>
    hasPermission(state.session, "orders.edit"),
  );
  const { list, current, pair, choose, diff } = usePoVersions(orderNo);
  if (list.isError) {
    return isForbidden(list.error) ? (
      <PermissionDenied />
    ) : (
      <ErrorPanel
        error={list.error}
        onRetry={() => {
          void list.refetch();
        }}
      />
    );
  }
  // A list read before a confirmation can sit in the cache at the old number.
  // Until it has caught up with the order, it is not drawn: it would say that
  // the order has one PO version, or that nobody was told about the old one.
  if (
    list.isPending ||
    list.data.data.currentPoVersionNo < (detail.poVersionNo ?? 1)
  ) {
    return <VersionsLoading label={t("order.versions.loading")} />;
  }
  const versions = list.data.data.versions;
  return (
    <div className="space-y-s3">
      {whoHasIt(detail) === "noTask" ? (
        <p className="fs-14 max-w-prose">
          {t("order.versions.noTask", { n: current })}
        </p>
      ) : null}
      {current === 1 ? (
        <>
          <p className="fs-14 max-w-prose text-muted-foreground">
            {t("order.versions.onlyOne")}
          </p>
          {mayEdit ? (
            <p className="fs-14 max-w-prose text-muted-foreground">
              {t("order.versions.howToRevise")}
            </p>
          ) : null}
        </>
      ) : null}
      <VersionList
        orderNo={orderNo}
        versions={versions}
        currency={currencyCode}
      />
      {current >= 2 ? (
        <section className="space-y-s2" aria-busy={diff.isPending}>
          <ComparePicker pair={pair} current={current} onChoose={choose} />
          <h3 className="fs-14 font-medium text-foreground">
            {t("order.versions.diffTitle", { from: pair.from, to: pair.to })}
          </h3>
          {diff.isPending ? (
            <p role="status" className="fs-14 text-muted-foreground">
              {t("order.versions.diffLoading")}
            </p>
          ) : diff.isError ? (
            <ErrorPanel
              error={diff.error}
              onRetry={() => {
                void diff.refetch();
              }}
            />
          ) : (
            <PoDifferences
              differences={diff.data.data}
              currency={currencyCode}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
