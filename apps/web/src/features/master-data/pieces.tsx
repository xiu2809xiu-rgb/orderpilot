import { CircleAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import type { ItemAvailability, MaskedField } from "@orderpilot/shared";
import { MaskedValue, Money, StatusBadge } from "@/components/common";
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

const BADGE_TONE = { short: "danger", low: "warning", ok: "success" } as const;

export function AvailabilityBadge({
  availability,
}: {
  availability: ItemAvailability;
}) {
  const { t } = useTranslation("master-data");
  return (
    <StatusBadge tone={BADGE_TONE[availability]}>
      {t(`availability.${availability}`)}
    </StatusBadge>
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

/** The facts under a record's header, one quiet panel rather than a row of boxes. */
export function KeyFacts({
  facts,
}: {
  facts: readonly { id: string; label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-s3 gap-y-s2 rounded-xl border bg-card p-s2 md:grid-cols-3 xl:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.id} className="min-w-0 space-y-0.5">
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="truncate text-sm">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
