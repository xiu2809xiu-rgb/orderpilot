import { operationLogReader } from "@orderpilot/shared";
import { SelectedLog } from "@/components/list-page/RecordLogPanel";
import { hasPermission, useSessionStore } from "@/stores/session";

const SPEC = {
  entityType: "Order" as const,
  entityId: (orderNo: string) => orderNo,
};

/**
 * The order's operation log: who did what and when, never a value or an IP
 * address. It is the panel the old Orders list showed under one ticked row.
 * Nothing is drawn for a role that may not read it, so it never asks for a
 * refusal.
 */
export function OrderOperationLog({ orderNo }: { orderNo: string }) {
  const allowed = useSessionStore((state) => {
    const reader = operationLogReader("Order");
    return reader !== undefined && hasPermission(state.session, reader);
  });
  if (!allowed) return null;
  return <SelectedLog spec={SPEC} entityId={orderNo} label={orderNo} />;
}
