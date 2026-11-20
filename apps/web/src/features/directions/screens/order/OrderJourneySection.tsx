import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ExpectedShip } from "./ExpectedShip";
import type { Journey } from "./journeyModel";
import { OrderJourney } from "./OrderJourney";

/**
 * The journey as one row of nine steps, with the forecast of the ship day on
 * the title's own line, so the section costs a heading and the rail. An order
 * the tracker does not know, or a role that may not read it, says so instead of
 * showing an empty rail.
 */
export function OrderJourneySection({
  journey,
  late,
  shipmentDate,
  refused,
}: {
  journey: Journey | null;
  late: boolean;
  shipmentDate: string | null;
  /** The role may not read the tracker, which holds the journey. */
  refused: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="dx-card od-journey-card">
      <header className="od-journey-head">
        <h2 id={headingId} className="dx-section-title">
          {t("order.journey.title")}
        </h2>
        {journey ? (
          <ExpectedShip journey={journey} shipmentDate={shipmentDate} />
        ) : null}
      </header>
      {journey ? (
        <OrderJourney journey={journey} size="full" late={late} />
      ) : (
        <p className="fs-14 max-w-prose text-muted-foreground">
          {t(refused ? "order.trackerRefused" : "peek.noJourney")}
        </p>
      )}
    </section>
  );
}
