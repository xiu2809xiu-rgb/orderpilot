import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDay } from "@/lib/format";
import { StatusChip } from "@/components/kit/StatusChip";
import { daysPastShipDate, type Journey } from "./journeyModel";
import { formatWeekday } from "./journeyText";

/**
 * The one line that sums the journey up: when the goods are expected to leave,
 * worked from how long each step took on similar orders, set against the ship
 * date on the order. A step the data cannot time adds nothing, and the line
 * names it. Once the goods are past that step it says so instead.
 */
export function ShipLine({
  journey,
  shipmentDate,
}: {
  journey: Journey;
  shipmentDate: string | null;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tp } = useTranslation("directions-parts");
  const { ship, current } = journey;

  if (!ship) {
    return (
      <p className="od-ship fs-14">
        {current >= 10 ? t("ship.allDone") : t("ship.left")}
      </p>
    );
  }
  const past = daysPastShipDate(ship, shipmentDate);
  const missing = ship.missing
    .map((id) => tp(`journey.sales.${id}`))
    .join(", ");
  return (
    <div className="od-ship-block">
      <p className="od-ship fs-14">
        {t("ship.expected", { day: formatWeekday(ship.date) })}
      </p>
      {past !== null ? (
        <p className="fs-14 flex flex-wrap items-center gap-2 text-muted-foreground">
          {past > 0 ? (
            <StatusChip kind="destructive" icon={TriangleAlert}>
              {t("ship.later", { count: past })}
            </StatusChip>
          ) : (
            <StatusChip kind="success" icon={CircleCheck}>
              {t("ship.within")}
            </StatusChip>
          )}
          {t("ship.orderDate", { date: formatDay(shipmentDate ?? "") })}
        </p>
      ) : null}
      {missing ? (
        <p className="fs-14 text-muted-foreground">
          {t("ship.missing", { steps: missing })}
        </p>
      ) : null}
    </div>
  );
}
