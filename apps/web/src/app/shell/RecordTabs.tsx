import { Suspense, lazy } from "react";
import { useRecordTabs } from "@/stores/recordTabs";
import { useRecordTabSync } from "./useRecordTabSync";

// The strip's markup, icons and dialog stay out of the first download.
const RecordTabStrip = lazy(() => import("./RecordTabStrip"));

/**
 * Keeps the open records in step with the page, and shows the strip under the
 * top bar once there is one. With no tab open it renders nothing at all.
 */
export function RecordTabs() {
  const record = useRecordTabSync();
  const open = useRecordTabs((state) => state.tabs.length > 0);
  if (!open) return null;
  return (
    <Suspense fallback={<div className="h-10 shrink-0 border-b" aria-hidden />}>
      <RecordTabStrip activeKey={record?.key} />
    </Suspense>
  );
}
