import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useMatches } from "react-router";
import { Button } from "@/components/ui/button";
import { routePattern } from "./AnalyticsTracker";
import { tracker, useConsent } from "./tracker";

/**
 * Mounted once in the signed-in shell. It asks for consent, and records one
 * page view per screen once consent is given. The route is turned into a
 * pattern here, so a record id never leaves the page.
 */
export default function AnalyticsRoot() {
  const consent = useConsent();
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

  return consent === "unset" ? <ConsentBanner /> : null;
}

function ConsentBanner() {
  const { t } = useTranslation("monitoring");
  return (
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-s2 bottom-s2 z-40 mx-auto max-w-xl rounded-lg border bg-card p-s3 text-card-foreground shadow-lg"
    >
      <h2 id="consent-title" className="text-base font-semibold">
        {t("consent.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("consent.description")}
      </p>
      <div className="mt-s2 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            tracker.grant();
          }}
        >
          {t("consent.allow")}
        </Button>
        <Button
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
