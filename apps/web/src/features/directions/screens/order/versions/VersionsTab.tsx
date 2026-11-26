import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ErrorPanel } from "@/components/common";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { takeConfirmedFocus } from "./confirmedFocus";
import { SubmittedVersions } from "./SubmittedVersions";
import { VersionsLoading } from "./VersionsLoading";

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
