import {
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip, type StatusKind } from "@/components/kit/StatusChip";
import type { RailTone } from "./orderTone";
import type { Journey } from "./journeyModel";
import { formatWeekday } from "./journeyText";

const PILL: Record<
  RailTone,
  { kind: StatusKind; icon: LucideIcon; key: string }
> = {
  normal: { kind: "success", icon: CircleCheck, key: "onTrack" },
  warning: { kind: "warning", icon: TriangleAlert, key: "atRisk" },
  critical: { kind: "destructive", icon: CircleAlert, key: "delayed" },
};

/**
 * When the goods are expected to leave, as a compact date, with the order's
 * own tone as a status pill: on track, at risk or delayed. The forecast
 * itself is worked from how long each step took on similar orders, which
 * the journey's own subtitle says once, for every order, so this line never
 * repeats it. A finished order, or one already past the shipping step, has
 * no forecast.
 */
export function ExpectedShip({
  journey,
  tone,
}: {
  journey: Journey;
  tone: RailTone;
}) {
  const { t } = useTranslation("directions-orders");
  const { ship } = journey;
  if (!ship) return null;
  const day = formatWeekday(ship.date);
  const pill = PILL[tone];
  return (
    <div className="od-ship fs-14">
      <span className="font-medium text-foreground">
        {t("order.journey.estShip", { day })}
      </span>
      <StatusChip kind={pill.kind} icon={pill.icon}>
        {t(`order.journey.status.${pill.key}`)}
      </StatusChip>
    </div>
  );
}
