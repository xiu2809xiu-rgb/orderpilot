import { CircleCheck, Clock, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KitSection } from "./KitSection";
import { StatusChip } from "./StatusChip";

export function StatusSection() {
  const { t } = useTranslation("directions-kit");
  return (
    <KitSection title={t("sections.status")} intro={t("status.intro")}>
      <div className="flex flex-wrap gap-2">
        <StatusChip kind="success" icon={CircleCheck}>
          {t("status.onTime")}
        </StatusChip>
        <StatusChip kind="warning" icon={Clock}>
          {t("status.waiting")}
        </StatusChip>
        <StatusChip kind="destructive" icon={TriangleAlert}>
          {t("status.mismatch")}
        </StatusChip>
        <StatusChip kind="info" icon={Info}>
          {t("status.information")}
        </StatusChip>
      </div>
    </KitSection>
  );
}
