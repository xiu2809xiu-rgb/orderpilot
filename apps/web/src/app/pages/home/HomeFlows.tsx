import { PurchaseFlow } from "./PurchaseFlow";
import { SalesFlow } from "./SalesFlow";

/** The sales flow, live, with the purchase flow beside it. */
export function HomeFlows() {
  return (
    <div className="grid gap-s3 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <SalesFlow />
      </div>
      <PurchaseFlow />
    </div>
  );
}
