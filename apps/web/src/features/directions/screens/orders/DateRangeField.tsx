import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rangeReversed } from "./ordersQuery";

const DAY_MS = 86_400_000;

function spanDays(from: string | null, to: string | null): number | null {
  return from && to
    ? Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1
    : null;
}

/**
 * The order date range: two days and, under them, how many days they span. A
 * From after its To is said at the fields, in words, and tied to both for a
 * screen reader. The range then filters nothing until it is put right, and no
 * span of negative days is shown.
 */
export function DateRangeField({
  from,
  to,
  onChange,
}: {
  from: string | null;
  to: string | null;
  onChange: (patch: { from?: string | null; to?: string | null }) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const id = useId();
  const reversed = rangeReversed({ from, to });
  const span = reversed ? null : spanDays(from, to);
  const errorId = `${id}-error`;
  const errorRef = useRef<HTMLParagraphElement>(null);
  // The panel scrolls inside a short window, and the dates are at its foot: the
  // message must not be left below the fold of the panel.
  useEffect(() => {
    if (!reversed) return;
    // The popover is still opening on the first frame, so its size is not final.
    const frame = requestAnimationFrame(() => {
      const message = errorRef.current;
      // jsdom has no scrollIntoView, and a test must not fail on that.
      if (message && "scrollIntoView" in message) {
        message.scrollIntoView({ block: "nearest" });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [reversed]);
  // Each day is held to the other in the picker, so a reversed range can only
  // come from typing or from an old address; the message below covers those.
  const field = (key: "from" | "to", value: string | null) => (
    <div className="space-y-1">
      <Label htmlFor={`${id}-${key}`} className="fs-12 text-muted-foreground">
        {t(`filters.${key}`)}
      </Label>
      <Input
        id={`${id}-${key}`}
        type="date"
        className="pointer-coarse:h-11"
        min={key === "to" ? (from ?? undefined) : undefined}
        max={key === "from" ? (to ?? undefined) : undefined}
        value={value ?? ""}
        aria-invalid={reversed || undefined}
        aria-describedby={reversed ? errorId : undefined}
        onChange={(event) => {
          onChange({ [key]: event.target.value || null });
        }}
      />
    </div>
  );
  return (
    <fieldset className="space-y-2">
      <legend className="fs-14 font-medium">{t("filters.orderDate")}</legend>
      <div className="grid grid-cols-2 gap-2 pointer-coarse:grid-cols-1">
        {field("from", from)}
        {field("to", to)}
      </div>
      {reversed ? (
        <p
          id={errorId}
          ref={errorRef}
          role="alert"
          className="od-range-error fs-14"
        >
          {t("filters.rangeReversed")}
        </p>
      ) : span !== null ? (
        <p className="od-span fs-14">{t("filters.span", { count: span })}</p>
      ) : null}
    </fieldset>
  );
}
