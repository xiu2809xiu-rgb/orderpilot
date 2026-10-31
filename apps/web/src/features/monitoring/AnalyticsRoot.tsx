import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLocation, useMatches } from "react-router";
import { Button } from "@/components/ui/button";
import { routePattern } from "./AnalyticsTracker";
import { useConsentCardVisible } from "./consentCard";
import { tracker, useConsent } from "./tracker";

/**
 * Mounted once in the signed-in shell. It asks for consent, and records one
 * page view per screen once consent is given. The route is turned into a
 * pattern here, so a record id never leaves the page.
 */
export default function AnalyticsRoot({
  dock,
}: {
  /** The shell's dock. The card is drawn inside it, never over the page. */
  dock: HTMLElement | null;
}) {
  const consent = useConsent();
  const cardVisible = useConsentCardVisible();
  const { pathname } = useLocation();
  const matches = useMatches();
  const params = matches.at(-1)?.params ?? {};
  const route = routePattern(pathname, params);

  // consent is a dependency on purpose: saying yes records the screen you are on.
  useEffect(() => {
    tracker.track("page_view", route);
  }, [route, consent]);

  // Waiting events go out when the tab is hidden or closed.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") void tracker.flush();
    }
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return dock && cardVisible ? createPortal(<ConsentCard />, dock) : null;
}

function ConsentCard() {
  const { t } = useTranslation("monitoring");
  return (
    <section
      data-consent-card=""
      aria-label={t("consent.label")}
      className="flex w-full flex-col gap-s2 border bg-card p-s2 text-card-foreground max-sm:border-x-0 max-sm:border-b-0 sm:w-80 sm:rounded-lg sm:shadow-md"
    >
      <p className="text-sm">{t("consent.description")}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            tracker.grant();
          }}
        >
          {t("consent.allow")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            tracker.deny();
          }}
        >
          {t("consent.decline")}
        </Button>
      </div>
    </section>
  );
}
