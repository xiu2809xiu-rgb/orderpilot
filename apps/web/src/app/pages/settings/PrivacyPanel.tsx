import { Suspense, lazy } from "react";
import { CardBones } from "../../shell/skeletons/CardBones";

// A separate chunk with the tracker, so the entry bundle does not grow. The
// card is area 4's: this page only decides where it sits.
const AnalyticsSettingsCard = lazy(
  () => import("@/features/monitoring/AnalyticsSettingsCard"),
);

/** Privacy: what OrderPilot counts about use, and the switch that decides it. */
export function PrivacyPanel() {
  return (
    <Suspense fallback={<CardBones lines={2} />}>
      <AnalyticsSettingsCard />
    </Suspense>
  );
}
