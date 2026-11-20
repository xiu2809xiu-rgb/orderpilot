import { useTranslation } from "react-i18next";
import { daysPastShipDate, type Journey } from "./journeyModel";
import { formatWeekday } from "./journeyText";

/**
 * When the goods are expected to leave, named as what it is: a forecast worked
 * from how long each step took on similar orders, set against the ship date on
 * the order. It says nothing about lateness in other words, because the page
 * says that once, with its badge. A step the data cannot time says so on the
 * rail. A finished order, or one already past the shipping step, has no forecast.
 */
export function ExpectedShip({
  journey,
  shipmentDate,
}: {
  journey: Journey;
  shipmentDate: string | null;
}) {
  const { t } = useTranslation("directions-orders");
  const { ship } = journey;
  if (!ship) return null;
  const day = formatWeekday(ship.date);
  const past = daysPastShipDate(ship, shipmentDate);
  const main =
    past === null
      ? t("order.ship.plain", { day })
      : past > 0
        ? t("order.ship.after", { day, count: past })
        : t("order.ship.inTime", { day });
  return (
    <div className="od-expected fs-14">
      <p>
        <span className="font-medium text-foreground">{main}.</span>{" "}
        <span className="text-muted-foreground">{t("order.ship.basis")}</span>
      </p>
    </div>
  );
}
