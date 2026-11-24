import { useTranslation } from "react-i18next";
import type { CopyChange } from "./copyChange";

/**
 * What a copy will do to the target, in numbers, before anyone confirms it
 * (#276): "Logistics gains 3 permissions and loses 1 permission." It is a
 * status, so a screen reader hears it change with the choices.
 */
export function CopyChangeNote({
  change,
  to,
}: {
  change: CopyChange;
  /** The target role's name, as people read it. */
  to: string;
}) {
  const { t } = useTranslation("governance");
  const gains = t("matrix.copy.count", { count: change.gains });
  const loses = t("matrix.copy.count", { count: change.loses });
  const key =
    change.gains > 0 && change.loses > 0
      ? "both"
      : change.gains > 0
        ? "gains"
        : change.loses > 0
          ? "loses"
          : "none";
  return (
    <p role="status" className="text-sm">
      {t(`matrix.copy.change.${key}`, { to, gains, loses })}
    </p>
  );
}
