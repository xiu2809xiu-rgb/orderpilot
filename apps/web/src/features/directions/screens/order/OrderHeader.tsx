import type { SalesOrderDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { EntryBadge } from "./EntryBadge";

/**
 * The head of the order page, in one line: the number with its entry badge
 * beside it, then the customer, and the person's one action to the right. It
 * is the shared page head's markup with the badge added, because that head
 * takes a plain title.
 */
export function OrderHeader({
  orderNo,
  intro,
  detail,
  actions,
}: {
  orderNo: string;
  intro: string;
  detail: SalesOrderDetail | undefined;
  actions: ReactNode;
}) {
  return (
    <header className="dx-page-head">
      <div className="od-title-row">
        <h1 className="dx-title">{orderNo}</h1>
        {detail ? <EntryBadge detail={detail} /> : null}
        <p className="dx-page-intro fs-14">{intro}</p>
      </div>
      <div className="dx-page-actions">{actions}</div>
    </header>
  );
}
