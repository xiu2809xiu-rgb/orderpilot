import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/** "5 minutes ago", "in 2 days". Pure, so it can be tested with a fixed `now`. */
export function formatRelative(then: Date, now: Date, locale = "en"): string {
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const [unit, size] =
    UNITS.find(([, size]) => Math.abs(seconds) >= size) ??
    (["second", 1] as const);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / size),
    unit,
  );
}

interface RelativeTimeProps {
  value: Date | string;
  /** A fixed "now" for tests and screenshots. Without it the text refreshes every minute. */
  now?: Date;
}

/** A time as words, with the exact time in a tooltip and in `dateTime`. */
export function RelativeTime({ value, now }: RelativeTimeProps) {
  const { t, i18n } = useTranslation("components");
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (now) return;
    const timer = setInterval(() => {
      setTick(new Date());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, [now]);

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <span>{t("time.unknown")}</span>;
  const exact = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
  return (
    <time dateTime={date.toISOString()} title={exact}>
      {formatRelative(date, now ?? tick, i18n.language)}
    </time>
  );
}
