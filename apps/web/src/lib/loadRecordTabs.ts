/**
 * The one place the tab strip's code is requested. The shell asks for it when
 * it first renders and a record click asks for it on use; sharing the call
 * keeps it to one request and keeps it out of the entry chunk.
 */
export function loadRecordTabs() {
  return import("@/app/shell/recordTabsRuntime");
}
