import type { OrderCaptureState } from "@orderpilot/shared";
import { useState } from "react";
import { useParams } from "react-router";
import type { DocumentRecordState } from "@/components/document-form";
import { ApiError } from "@/lib/api/errors";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { hasPermission, useSessionStore } from "@/stores/session";
import { OrderDocument } from "./OrderDocument";
import type { ReadOnlyReason } from "./OrderNotices";

function reasonOf(
  captureState: OrderCaptureState | null,
  mayEdit: boolean,
): ReadOnlyReason | null {
  if (captureState === null) return "sample";
  if (captureState !== "draft") return captureState;
  return mayEdit ? null : "permission";
}

/**
 * A stored order on its own page. A draft is edited here by a role that may
 * edit; a sample, a submitted or void order, or a role that may only read
 * sees the same document with every field locked, and says why.
 */
export default function DraftOrderPage() {
  const { orderNo = "" } = useParams();
  const mayEdit = hasPermission(
    useSessionStore((state) => state.session),
    "orders.edit",
  );
  const [reloads, setReloads] = useState(0);
  const order = useOrdersOne(orderNo);
  const record = order.data?.data ?? null;

  let state: DocumentRecordState | undefined;
  if (order.isPending) state = { kind: "loading" };
  else if (order.error) {
    state =
      order.error instanceof ApiError && order.error.status === 404
        ? { kind: "notFound" }
        : {
            kind: "error",
            error: order.error,
            onRetry: () => void order.refetch(),
          };
  }
  // The key changes when the record's state does, so a void order opens read-only
  // at once. An own save does not change it, so typing and focus stay.
  const key = record
    ? `${orderNo}:${record.captureState ?? "sample"}:${String(reloads)}`
    : `${orderNo}:pending`;
  return (
    <OrderDocument
      key={key}
      record={record}
      {...(state ? { state } : {})}
      priceMasked={record?.amount.masked ?? false}
      readOnly={record ? reasonOf(record.captureState, mayEdit) : "permission"}
      onReload={() => {
        void order.refetch().then(() => {
          setReloads((count) => count + 1);
        });
      }}
    />
  );
}
