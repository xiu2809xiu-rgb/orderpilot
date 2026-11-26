import type { LineDifferenceView } from "@orderpilot/shared";
import { ArrowDownUp, Minus, PenLine, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { StatusChip } from "@/components/kit/StatusChip";

/**
 * The chip of a line's status: a word and an icon. A line that only moved says
 * "Moved", never "Unchanged", since its position is what differs; a line that
 * did not move is quiet.
 */
export function StatusCell({
  status,
  moved,
  pricesCompared,
}: {
  status: LineDifferenceView["status"];
  moved: boolean;
  pricesCompared: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  if (status === "added") {
    return (
      <StatusChip kind="success" icon={Plus}>
        {t("order.versions.status.added")}
      </StatusChip>
    );
  }
  if (status === "removed") {
    return (
      <StatusChip kind="destructive" icon={Minus}>
        {t("order.versions.status.removed")}
      </StatusChip>
    );
  }
  if (status === "changed") {
    return (
      <StatusChip kind="warning" icon={PenLine}>
        {t("order.versions.status.changed")}
      </StatusChip>
    );
  }
  if (moved) {
    return (
      <StatusChip kind="info" icon={ArrowDownUp}>
        {t("order.versions.status.moved")}
      </StatusChip>
    );
  }
  return (
    <Badge variant="outline" radius="full" className="text-muted-foreground">
      {t(
        pricesCompared
          ? "order.versions.status.unchanged"
          : "order.versions.status.unchangedMasked",
      )}
    </Badge>
  );
}
