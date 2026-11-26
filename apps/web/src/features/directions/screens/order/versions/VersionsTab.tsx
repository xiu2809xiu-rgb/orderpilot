import type { SalesOrderDetail } from "@orderpilot/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ErrorPanel, PermissionDenied } from "@/components/common";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { isForbidden } from "@/lib/query-status";
import { hasPermission, useSessionStore } from "@/stores/session";
import { takeConfirmedFocus } from "./confirmedFocus";
import { ComparePicker } from "./ComparePicker";
import { PoDifferences } from "./PoDifferences";
import { usePoVersions } from "./usePoVersions";
import { VersionsLoading } from "./VersionsLoading";
import { VersionList } from "./VersionList";
import { whoHasIt } from "./versionsModel";

/** The PO versions of a submitted order: the list, the comparison, and who was told. */
function SubmittedVersions({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const { orderNo, currencyCode } = detail;
  const mayEdit = useSessionStore((state) =>
    hasPermission(state.session, "orders.edit"),
  );
  const { list, current, pair, choose, diff } = usePoVersions(orderNo);
  if (list.isPending) {
    return <VersionsLoading label={t("order.versions.loading")} />;
  }
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

/**
 * The Versions tab. Only a submitted order has PO versions, so a sample, a draft
 * and a void order each say so in one sentence and ask the server for nothing.
 * It reads the order from the cache the page has already filled. After a
 * confirmed revision the heading takes focus once, so a person lands on the
 * new version and a screen reader says where.
 */
export function VersionsTab({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("directions-orders");
  const order = useOrdersOne(orderNo, { query: { retryOnMount: false } });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // In an effect: a second run, in strict mode, finds the mark taken.
    if (takeConfirmedFocus(orderNo)) heading.current?.focus();
  }, [orderNo]);
  const detail = order.data?.data;
  let body;
  if (order.isPending) {
    body = <VersionsLoading label={t("order.versions.loading")} />;
  } else if (!detail) {
    body = (
      <ErrorPanel
        error={order.error}
        onRetry={() => {
          void order.refetch();
        }}
      />
    );
  } else if (detail.captureState === "draft") {
    body = (
      <p className="fs-14 max-w-prose text-muted-foreground">
        {t("order.versions.draftNone")}
      </p>
    );
  } else if (detail.captureState === "void") {
    body = (
      <p className="fs-14 max-w-prose text-muted-foreground">
        {t("order.versions.voidNone")}
      </p>
    );
  } else if (
    detail.captureState === null ||
    typeof detail.poVersionNo !== "number"
  ) {
    body = (
      <p className="fs-14 max-w-prose text-muted-foreground">
        {t("order.versions.sampleOne")}
      </p>
    );
  } else {
    body = <SubmittedVersions detail={detail} />;
  }
  return (
    <div className="space-y-s2">
      <h2
        ref={heading}
        tabIndex={-1}
        className="fs-14 font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {t("order.versions.title")}
      </h2>
      {body}
    </div>
  );
}
