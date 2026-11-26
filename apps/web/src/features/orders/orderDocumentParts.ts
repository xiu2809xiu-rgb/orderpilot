import type { OrderCaptureState, SalesOrderDetail } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import type {
  DocumentStatus,
  DocumentTabsSpec,
} from "@/components/document-form";
import { CAPTURE_FAMILY } from "./captureFamily";
import type { ReadOnlyReason } from "./OrderNotices";

/**
 * The key a typed draft is stored under. A read-only page has a key of its own,
 * or a draft typed against the editable page would come back over a void order.
 */
export function draftKeyOf(
  orderNo: string | null,
  readOnly: ReadOnlyReason | null,
): string {
  if (orderNo === null) return "order.new";
  return readOnly === null ? `order.${orderNo}` : `order.${orderNo}.read`;
}

/** The badge by the title: the entry state, a sample, or a form not saved yet. */
export function statusOf(
  t: TFunction,
  record: SalesOrderDetail | null,
  captureState: OrderCaptureState | null,
): DocumentStatus {
  return {
    family: captureState ? CAPTURE_FAMILY[captureState] : "draft",
    label: captureState
      ? t(`captureStates.${captureState}`)
      : t(record ? "sampleTag" : "form.statusNew"),
  };
}

/** The tabs under the form: empty ones say so, and a saved order has its log. */
export function tabsOf(t: TFunction, orderNo: string | null): DocumentTabsSpec {
  const emptyText = t("form.tabsEmpty");
  return {
    timeline: { content: null, emptyText },
    checks: { content: null, emptyText },
    documents: { content: null, emptyText },
    ...(orderNo
      ? { log: { entityType: "Order" as const, entityId: orderNo } }
      : {}),
  };
}
