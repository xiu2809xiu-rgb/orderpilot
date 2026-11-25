import type { PersonAvailability } from "@orderpilot/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * The words of a read-only availability dot that has no visible words beside
 * it, such as the one on a colleague's avatar: "Availability: Do not
 * disturb", for `UserAvatar`'s `availability` prop. A dot that sits beside its
 * own visible words, as in the Demo role menu, shows the value's words
 * (`availability.values`) and needs no second sentence for a screen reader.
 */
export function useAvailabilityDot() {
  const { t } = useTranslation();
  return useCallback(
    (value: PersonAvailability) => ({
      value,
      label: t("availability.dotLabel", {
        value: t(`availability.values.${value}`),
      }),
    }),
    [t],
  );
}
