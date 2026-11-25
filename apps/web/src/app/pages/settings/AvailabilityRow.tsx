import { PERSON_AVAILABILITY_HOLD_HOURS } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { ErrorPanel } from "@/components/common";
import { SettingRow } from "@/components/parts/SettingRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime } from "@/lib/format";
import type { UseAvailability } from "@/lib/useAvailability";
import { useSessionStore } from "@/stores/session";
import { AvailabilityRefused } from "./AvailabilityRefused";

/** What the row says the value is: its words, and when it ends if it does. */
function valueWords(availability: UseAvailability, t: TFunction): string {
  const words = t(`common:availability.values.${availability.value}`);
  if (availability.value === "AVAILABLE" || !availability.expiresAt) {
    return words;
  }
  return t("account.availability.until", {
    value: words,
    time: formatTime(availability.expiresAt),
  });
}

/**
 * The Availability row of the profile card: the value in words with its end,
 * and the button that opens the same menu as the ring. It holds every state
 * of the choice: loading, error, saving, refused, fallen back after 12 hours.
 */
export function AvailabilityRow({
  availability,
  open,
  onChange,
  buttonRef,
}: {
  availability: UseAvailability;
  open: boolean;
  /** Scrolls the ring into view and opens the menu on it. */
  onChange: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation("settings");
  const demo = useSessionStore((state) => state.session?.demo ?? false);
  const { status, saving } = availability;

  const control =
    status === "error" ? null : (
      <div className="flex flex-wrap items-center gap-s3 sm:justify-end">
        {status === "loading" ? (
          <>
            <Skeleton className="h-5 w-32" />
            <span className="sr-only" role="status">
              {t("account.availability.loading")}
            </span>
          </>
        ) : (
          <span className="fs-14">{valueWords(availability, t)}</span>
        )}
        {saving ? (
          <span role="status" className="fs-12 text-muted-foreground">
            {t("account.availability.saving")}
          </span>
        ) : null}
        <Button
          ref={buttonRef}
          type="button"
          variant="outline"
          aria-haspopup="menu"
          aria-expanded={open}
          // Off only while the value is being read. While a save is in flight
          // it stays focusable and a press does nothing, as the ring does:
          // the menu hands focus back to this button when it closes, and a
          // disabled button would let it fall to the page.
          disabled={status !== "ready"}
          aria-busy={saving || undefined}
          onClick={saving ? undefined : onChange}
        >
          {t("account.availability.change")}
        </Button>
      </div>
    );

  return (
    <SettingRow
      label={t("account.availability.label")}
      description={t("account.availability.description", {
        hours: PERSON_AVAILABILITY_HOLD_HOURS,
      })}
      control={control}
      align="start"
    >
      <div className="flex flex-col gap-s3 pt-s2">
        {status === "error" ? (
          <ErrorPanel
            error={availability.error}
            onRetry={availability.retryLoad}
          />
        ) : null}
        {availability.refused ? (
          <AvailabilityRefused
            error={availability.refused}
            onRetry={availability.retryLast}
          />
        ) : null}
        {availability.fellBack ? (
          <p role="status" className="fs-14 text-muted-foreground">
            {t("account.availability.fellBack", {
              hours: PERSON_AVAILABILITY_HOLD_HOURS,
            })}
          </p>
        ) : null}
        {demo ? (
          <p className="fs-14 max-w-prose text-muted-foreground">
            {t("account.availability.demoShared")}{" "}
            {t("account.availability.demoSeen")}
          </p>
        ) : null}
        <p className="fs-12 max-w-prose text-muted-foreground">
          {t("account.availability.footnote")}
        </p>
      </div>
    </SettingRow>
  );
}
