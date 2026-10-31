import { useSyncExternalStore } from "react";
import { clickstreamRecord } from "@/lib/api/generated/endpoints/analytics/analytics";
import {
  AnalyticsTracker,
  readPrivacySignals,
  type ConsentState,
} from "./AnalyticsTracker";

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    // Blocked storage: the tracker keeps the choice for this visit only.
    return undefined;
  }
}

/** The app's one tracker. It sends through the generated call, so CSRF and the request id apply. */
export const tracker = new AnalyticsTracker({
  send: (batch) => clickstreamRecord(batch),
  storage: browserStorage(),
  signals: readPrivacySignals(navigator),
});

/** The consent state, kept in step with the tracker. */
export function useConsent(): ConsentState {
  return useSyncExternalStore(
    tracker.subscribe,
    () => tracker.consent,
    () => "unset" as const,
  );
}
