import { Suspense, lazy } from "react";
import { showPlannedFeatures } from "@/features/registry";
import { SalesFlow } from "./SalesFlow";

// The purchase flow card is a developer's preview of Phase 2. In a production
// build the import is gone, so nothing about it ships.
const PurchaseFlow = import.meta.env.DEV
  ? lazy(() => import("./PurchaseFlow"))
  : null;

/** The sales flow, live. With the developer flag on, the purchase flow beside it. */
export function HomeFlows() {
  const preview = PurchaseFlow !== null && showPlannedFeatures();
  return (
    <div
      className={
        preview
          ? "grid grid-cols-1 items-start gap-s3 lg:grid-cols-[minmax(0,1fr)_16rem]"
          : undefined
      }
    >
      <div className="min-w-0">
        <SalesFlow />
      </div>
      {preview ? (
        <Suspense fallback={null}>
          <PurchaseFlow />
        </Suspense>
      ) : null}
    </div>
  );
}
