import { useTranslation } from "react-i18next";
import { JourneyRail } from "@/components/parts/JourneyRail";
import { heldLine, heldReasons } from "./heldReasons";
import { AgeCell } from "./OrderFigures";
import { stageWordKey, type OrderRow } from "./orderRow";

/**
 * Where the order is, in Spectra's words, with what a person needs next to it:
 * how old the order is and whether it is late, and, for a held order, why. The
 * nine-dot rail adds a line to every row, so it shows only where the window
 * has room (`dots`). An order the tracker does not know, such as one entered
 * here, has no journey and says so in words.
 */
export function StageCell({
  row,
  today,
  dots,
}: {
  row: OrderRow;
  today: string;
  dots: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const label = row.status?.label ?? row.workflowStatus ?? "";
  const reasons = heldReasons(row, t);
  return (
    <span className="od-stage">
      {row.step !== null && dots ? (
        <JourneyRail
          flow="sales"
          size="row"
          current={row.step}
          late={row.overdue?.overdue === true}
        />
      ) : null}
      {row.step === null ? (
        <span className="od-stage-label text-muted-foreground">
          {label || t(stageWordKey(row))}
        </span>
      ) : (
        <span className="od-stage-label" title={label}>
          {label}
        </span>
      )}
      <AgeCell row={row} today={today} />
      {reasons.length > 0 ? (
        <span className="od-why fs-12" title={reasons.join("; ")}>
          {heldLine(reasons, t)}
        </span>
      ) : null}
    </span>
  );
}
