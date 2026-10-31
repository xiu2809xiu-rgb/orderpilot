import { useEffect, useState } from "react";
import { CONSENT_STORAGE_KEY } from "./AnalyticsTracker";
import { useConsent } from "./tracker";

/** Set the first time the card appears. It is not the consent: asking once is all it records. */
export const CARD_SHOWN_KEY = "op.analytics.consent-card-shown";

// Kept in memory too, so blocked storage still means "once per visit", not "every page".
let shownThisVisit = false;

function wasShown(): boolean {
  if (shownThisVisit) return true;
  try {
    return window.localStorage.getItem(CARD_SHOWN_KEY) !== null;
  } catch {
    return false;
  }
}

function markShown(): void {
  shownThisVisit = true;
  try {
    window.localStorage.setItem(CARD_SHOWN_KEY, "1");
  } catch {
    // Blocked storage: the in-memory flag still holds for this visit.
  }
}

/**
 * True while the card should be on screen: the person has not chosen and the
 * card has not been shown in an earlier visit. The first render decides, so the
 * card stays until it is answered, and an ignored card never returns.
 */
export function useConsentCardVisible(): boolean {
  const consent = useConsent();
  const [firstTime] = useState(() => !wasShown());
  const visible = consent === "unset" && firstTime;
  useEffect(() => {
    if (visible) markShown();
  }, [visible]);
  return visible;
}

function read(): "granted" | "denied" | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/** The saved choice, whatever the browser signals say. It reads the tracker's own key. */
export function useSavedChoice(): "granted" | "denied" | null {
  const consent = useConsent();
  const [saved, setSaved] = useState<"granted" | "denied" | null>(read);
  useEffect(() => {
    setSaved(read());
  }, [consent]);
  return saved;
}
