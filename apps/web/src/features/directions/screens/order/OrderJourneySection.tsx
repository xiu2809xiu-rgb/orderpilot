import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ExpectedShip } from "./ExpectedShip";
import type { Journey } from "./journeyModel";
import { OrderJourney } from "./OrderJourney";
import type { RailTone } from "./orderTone";

/**
 * The journey as one row of nine steps, with the title and its subtitle on
 * the left and the ship forecast with its tone pill on the right, so the
 * section costs a heading and the rail. An order the tracker does not know,
 * or a role that may not read it, says so instead of showing an empty rail.
 */
export function OrderJourneySection({
  journey,
  late,
  refused,
  typedHere,
  tone,
}: {
  journey: Journey | null;
  late: boolean;
  /** The role may not read the tracker, which holds the journey. */
  refused: boolean;
  /** Entered here and submitted, held by no team: it has no journey and will not get one by waiting. */
  typedHere: boolean;
  /** The order's health: colours the rail and the ship forecast's pill. */
  tone: RailTone;
}) {
  const { t } = useTranslation("directions-orders");
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="dx-card od-journey-card">
      <header className="od-journey-head">
        <div className="od-journey-title">
          <h2 id={headingId} className="dx-section-title">
            {t("order.journey.title")}
          </h2>
          <p className="od-journey-subtitle dx-meta">
            {t("order.journey.subtitle")}
          </p>
        </div>
        {journey ? <ExpectedShip journey={journey} tone={tone} /> : null}
      </header>
      {journey ? (
        <OrderJourney journey={journey} size="full" late={late} tone={tone} />
      ) : (
        <p className="fs-14 max-w-prose text-muted-foreground">
          {t(
            refused
              ? "order.trackerRefused"
              : typedHere
                ? "peek.noJourneyTypedHere"
                : "peek.noJourney",
          )}
        </p>
      )}
    </section>
  );
}
