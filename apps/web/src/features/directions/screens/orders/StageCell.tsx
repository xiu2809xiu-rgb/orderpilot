import { useTranslation } from "react-i18next";
import { JourneyRail } from "@/components/parts/JourneyRail";
import type { OrderRow } from "./orderRow";

/**
 * Where the order is: the small journey rail, nine marks with the current one
 * lit, and the status in Spectra's words beside it. An order the tracker does
 * not know, such as a draft entered here, has no journey yet and says so in
 * words instead of showing a rail with nothing on it.
 */
export function StageCell({ row }: { row: OrderRow }) {
  const { t } = useTranslation("directions-orders");
  if (row.step === null) {
    return (
      <span className="text-muted-foreground">
        {row.workflowStatus ?? t("cells.notStarted")}
      </span>
    );
  }
  const label = row.status?.label ?? row.workflowStatus ?? "";
  return (
    <span className="od-stage">
      <JourneyRail
        flow="sales"
        size="row"
        current={row.step}
        late={row.overdue?.overdue === true}
      />
      <span className="od-stage-label" title={label}>
        {label}
      </span>
    </span>
  );
}
