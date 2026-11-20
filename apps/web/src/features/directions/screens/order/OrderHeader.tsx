import type { SalesOrderDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { EntryBadge } from "./EntryBadge";
import { EntryMeaning } from "./EntryMeaning";

/**
 * The head of the order page, in one line: the number with its entry badge
 * beside it, then the customer, and the person's one action to the right. It
 * is the shared page head's markup with the badge added, because that head
 * takes a plain title. An order entered here says on a line of its own what
 * became of it; a sample says it from its badge.
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
        {detail?.captureState ? (
          <EntryMeaning state={detail.captureState} />
        ) : null}
      </div>
      <div className="dx-page-actions">{actions}</div>
    </header>
  );
}
