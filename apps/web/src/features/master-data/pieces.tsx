import { CircleAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import type { ItemAvailability, MaskedField } from "@orderpilot/shared";
import {
  MaskedValue,
  Money,
  StatusChip,
  type MaskReason,
  type StatusFamily,
} from "@/components/common";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

/** "India" from "IN". */
export function countryName(code: string): string {
  return COUNTRY_NAMES.of(code) ?? code;
}

const TABS = ["items", "customers", "vendors"] as const;

/** Items, Customers and Vendors. Links, not tabs: each is its own page with its own address. */
export function MasterDataTabs() {
  const { t } = useTranslation("master-data");
  return (
    <nav aria-label={t("tabs.label")} className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <NavLink
          key={tab}
          to={`/master-data/${tab}`}
          className={({ isActive }) =>
            cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )
          }
        >
          {t(`tabs.${tab}`)}
        </NavLink>
      ))}
    </nav>
  );
}

/** An amount the server may have masked. A masked one has no value to show. */
export function MaskedMoney({ field }: { field: MaskedField }) {
  if (field.masked || field.value === null) {
    return <MaskedValue masked reason={field.reason ?? "role"} />;
  }
  return <Money value={field.value} />;
}

/**
 * Why a whole column is hidden, or null when any cell of it can be read. A
 * column is only quietened when no row shows a value, so one readable cell
 * never hides behind a header that says otherwise.
 */
export function maskedColumnReason(
  fields: readonly MaskedField[],
): MaskReason | null {
  const first = fields[0];
  if (!first || !fields.every((field) => field.masked)) return null;
  return first.reason ?? "role";
}

/** A cell of a column that the header already says is hidden: a dash, said as "Hidden" to a screen reader. */
export function QuietDash() {
  const { t } = useTranslation("master-data");
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">-</span>
      <span className="sr-only">{t("table.hiddenCell")}</span>
    </span>
  );
}

/** A bank detail or other text the server may have masked. Codes read best in mono, names do not. */
export function MaskedText({
  field,
  mono = true,
}: {
  field: MaskedField;
  mono?: boolean;
}) {
  if (field.masked || field.value === null) {
    return <MaskedValue masked reason={field.reason ?? "role"} />;
  }
  return <span className={mono ? "font-mono" : undefined}>{field.value}</span>;
}

// Short is blocked, low is waiting for the next purchase, ok is ready to promise.
const AVAILABILITY_FAMILY: Record<ItemAvailability, StatusFamily> = {
  short: "blocked",
  low: "waiting",
  ok: "ready",
};

export function AvailabilityBadge({
  availability,
}: {
  availability: ItemAvailability;
}) {
  const { t } = useTranslation("master-data");
  return (
    <StatusChip family={AVAILABILITY_FAMILY[availability]}>
      {t(`availability.${availability}`)}
    </StatusChip>
  );
}

/** Available stock in a table: the figure, with a word and an icon when short or low. */
export function AvailableFigure({
  value,
  availability,
}: {
  value: string;
  availability: ItemAvailability;
}) {
  const { t } = useTranslation("master-data");
  if (availability === "ok") return formatQuantity(value);
  const short = availability === "short";
  const Icon = short ? CircleAlert : TriangleAlert;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        short ? "text-destructive" : "text-warning",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="text-xs">{t(`availability.${availability}`)}</span>
      <span>{formatQuantity(value)}</span>
    </span>
  );
}

export interface KeyFact {
  id: string;
  label: string;
  value: ReactNode;
  /** Long text, such as an address: it spans two columns and wraps instead of being cut. */
  wrap?: boolean;
}

/** The facts under a record's header, on one card, label over value as on the order page. */
export function KeyFacts({ facts }: { facts: readonly KeyFact[] }) {
  return (
    <dl className="rec-facts dx-card">
      {facts.map((fact) => (
        <div
          key={fact.id}
          className="rec-fact"
          data-wide={fact.wrap === true ? "" : undefined}
        >
          <dt>{fact.label}</dt>
          <dd className={fact.wrap ? "break-words" : "truncate"}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
