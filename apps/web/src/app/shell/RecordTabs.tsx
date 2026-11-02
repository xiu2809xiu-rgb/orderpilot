import { useRecordTabs } from "@/stores/recordTabs";
import RecordTabStrip from "./RecordTabStrip";
import { useRecordTabSync } from "./useRecordTabSync";

/**
 * Keeps the open records in step with the page, and shows the strip under the
 * top bar once there is one. With no tab open it renders nothing at all.
 */
export function RecordTabs() {
  const record = useRecordTabSync();
  const open = useRecordTabs((state) => state.tabs.length > 0);
  if (!open) return null;
  return <RecordTabStrip activeKey={record?.key} />;
}
