// Everything that runs only once a record opens, behind one dynamic import so
// it downloads as a single chunk that the entry bundle does not carry: the strip,
// the code that keeps it in step with the page, and the click handling in
// `openRecord`. The shell starts the download on its first render.
export { openRecord } from "@/components/common/openRecord";
export { RecordTabs } from "./RecordTabs";
