import { useTranslation } from "react-i18next";
import { JourneyRail, type RailSize } from "../../parts/JourneyRail";
import type { Journey } from "./journeyModel";
import { journeyDetails } from "./journeyText";

/**
 * The nine steps of an order as the direction's own rail, each with its state
 * in words and the line the data supports: who and when for a done step, the
 * wait against the usual time for the current one, the expected day for a
 * later one. The same component is full in the order page and vertical in the
 * side peek.
 */
export function OrderJourney({
  journey,
  size,
  late,
}: {
  journey: Journey;
  size: Exclude<RailSize, "row">;
  late: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <JourneyRail
      flow="sales"
      size={size}
      current={journey.current}
      late={late}
      details={journeyDetails(t, journey, size === "full")}
    />
  );
}
