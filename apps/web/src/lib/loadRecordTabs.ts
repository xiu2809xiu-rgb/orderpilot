/**
 * The one place the tab strip's code is requested. The shell asks for it after
 * the first paint and a record click asks for it on use; sharing the call keeps
 * the entry bundle to one download list and one request.
 */
export function loadRecordTabs() {
  return import("@/app/shell/recordTabsRuntime");
}
