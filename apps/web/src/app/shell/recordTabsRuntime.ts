// Everything that runs only once a record opens, behind one dynamic import so
// it downloads as a single chunk after the first paint: the strip, the code
// that keeps it in step with the page, and the click handling in `openRecord`.
export { openRecord } from "@/components/common/openRecord";
export { RecordTabs } from "./RecordTabs";
