import { PurchaseFlow } from "./PurchaseFlow";
import { SalesFlow } from "./SalesFlow";

/** The sales flow, live, with the purchase flow beside it. */
export function HomeFlows() {
  return (
    <div className="grid grid-cols-1 gap-s3 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0">
        <SalesFlow />
      </div>
      <PurchaseFlow />
    </div>
  );
}
