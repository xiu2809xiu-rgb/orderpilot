import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ShineBorder } from "../../kit/ShineBorder";
import type { Journey } from "./journeyModel";
import { usualWords } from "./journeyText";
import { ShipLine } from "./ShipLine";

/**
 * Where the order is, in one card: the current step in words (the status as
 * Spectra says it), who holds it, how long it has been there against what it
 * usually takes, and the line that sums the journey up. A slow shine travels
 * the border of the card for as long as the order waits at a step; a finished
 * order has no shine because nothing is waiting.
 */
export function NowCard({
  journey,
  stageLabel,
  heldAt,
  shipmentDate,
}: {
  journey: Journey;
  stageLabel: string;
  heldAt: string;
  shipmentDate: string | null;
}) {
  const { t } = useTranslation("directions-orders");
  const now = journey.steps.find((step) => step.state === "now");
  const done = journey.current >= 10;
  return (
    <div className="od-now" data-late={now?.late ? "" : undefined}>
      {done ? null : <ShineBorder />}
      <div className="od-now-main">
        <p className="od-now-label fs-12">{t("order.now.label")}</p>
        <p className="od-now-stage fs-20">{stageLabel}</p>
        {done ? (
          <p className="fs-14 flex items-center gap-2 text-muted-foreground">
            <CircleCheck aria-hidden="true" className="size-4" />
            {t("ship.allDone")}
          </p>
        ) : (
          <p className="fs-14 text-muted-foreground">
            {t("order.now.heldAt", { team: heldAt })}
            {now?.usual
              ? ` ${t(now.late ? "order.now.pastUsual" : "order.now.usual", { usual: usualWords(t, now.usual) })}`
              : ""}
          </p>
        )}
      </div>
      <div className="od-now-ship">
        <ShipLine journey={journey} shipmentDate={shipmentDate} />
      </div>
    </div>
  );
}
