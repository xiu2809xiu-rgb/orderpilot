import type { SalesOrderDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { opticalStyle } from "@/lib/opticalEdge";
import { EntryBadge } from "./EntryBadge";
import { EntryMeaning } from "./EntryMeaning";
import { PoVersionChip } from "./versions/PoVersionChip";

/**
 * The head of the order page, in one line: the number with its entry badge
 * beside it, then the customer, vertically centred with them both, and the
 * person's one action to the right. The customer's number is styled as it is
 * in the Orders table: small and muted, beside the name, with no comma. An
 * order entered here says on a line of its own what became of it; a sample
 * says it from its badge.
 */
export function OrderHeader({
  orderNo,
  customerName,
  customerNo,
  detail,
  actions,
}: {
  orderNo: string;
  customerName: string;
  customerNo: string;
  detail: SalesOrderDetail | undefined;
  actions: ReactNode;
}) {
  return (
    <header className="dx-page-head">
      <div className="od-title-row">
        <h1 className="dx-title optical-start" style={opticalStyle(orderNo)}>
          {orderNo}
        </h1>
        {detail ? <EntryBadge detail={detail} /> : null}
        <PoVersionChip poVersionNo={detail?.poVersionNo ?? null} />
        <span className="od-title-customer fs-14">
          <span className="text-foreground">{customerName}</span>
          <span className="numeral od-customer-no">{customerNo}</span>
        </span>
        {detail?.captureState ? (
          <EntryMeaning state={detail.captureState} />
        ) : null}
      </div>
      <div className="dx-page-actions">{actions}</div>
    </header>
  );
}
