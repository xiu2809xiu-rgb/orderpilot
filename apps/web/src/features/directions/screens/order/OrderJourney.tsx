import { useTranslation } from "react-i18next";
import { ScrollRegion } from "@/components/common";
import { JourneyRail, type RailSize } from "@/components/parts/JourneyRail";
import type { Journey } from "./journeyModel";
import { journeyDetails } from "./journeyText";

/**
 * The nine steps of an order as the rail, each with its state
 * in words and the line the data supports: who and when for a done step, the
 * wait against the usual time for the current one, the expected day for a
 * later one. The same component is full in the order page and vertical in the
 * side peek. The full rail is nine columns wide, so on a phone it scrolls in a
 * box a keyboard can reach, drawn with no frame of its own.
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
  const rail = (
    <JourneyRail
      flow="sales"
      size={size}
      current={journey.current}
      // The full rail is the order page's, where the badge under the title says
      // how late the order is, once. The rail would add a second figure from
      // another sum ("Now, late" beside the wait), so it says "Now" only. The
      // side peek has no badge, so its vertical rail keeps the word.
      late={size === "full" ? false : late}
      details={journeyDetails(t, journey, size === "full")}
    />
  );
  if (size !== "full") return rail;
  return (
    <ScrollRegion
      label={t("order.journey.region")}
      className="od-rail-scroll rounded-none border-0 bg-transparent"
    >
      {rail}
    </ScrollRegion>
  );
}
