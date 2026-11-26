import type { PoVersionDifferences } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { formatDay } from "@/lib/format";
import { PriceCell } from "./PriceCell";

type HeaderField = PoVersionDifferences["header"][number]["field"];

/** A header value as a person reads it: a date as a day, a percent with its sign. */
function headerValue(
  field: HeaderField,
  value: string | null,
  notSet: string,
): string {
  if (value === null) return notSet;
  if (field === "orderDate" || field === "shipmentDate")
    return formatDay(value);
  return field === "prepaymentPercent" ? `${value}%` : value;
}

/**
 * The order's own fields, field by field: each says Same, or what it was and
 * what it is, with a Changed chip. The total is the one price here, and a role
 * that may not see prices gets a mask in its place.
 */
export function HeaderDifferences({
  differences,
  currency,
}: {
  differences: PoVersionDifferences;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  const notSet = t("order.versions.notSet");
  return (
    <dl className="fs-14 grid grid-cols-[max-content_1fr] items-center gap-x-s3 gap-y-s1">
      {differences.header.map((row) => (
        <div key={row.field} className="contents">
          <dt className="text-muted-foreground">
            {t(`order.versions.header.${row.field}`)}
          </dt>
          <dd className="flex flex-wrap items-center gap-s1">
            {row.changed ? (
              <>
                <span className="numeral">
                  {t("order.versions.change", {
                    from: headerValue(row.field, row.from, notSet),
                    to: headerValue(row.field, row.to, notSet),
                  })}
                </span>
                <Badge variant="warning" radius="full">
                  {t("order.versions.changed")}
                </Badge>
              </>
            ) : (
              <span className="text-muted-foreground">
                {t("order.versions.same")}
              </span>
            )}
          </dd>
        </div>
      ))}
      <div className="contents">
        <dt className="text-muted-foreground">
          {t("order.versions.header.total")}
        </dt>
        <dd className="flex flex-wrap items-center gap-s1">
          {differences.total.masked || differences.total.changed ? (
            <PriceCell price={differences.total} currency={currency} />
          ) : (
            <span className="text-muted-foreground">
              {t("order.versions.same")}
            </span>
          )}
          {!differences.total.masked && differences.total.changed ? (
            <Badge variant="warning" radius="full">
              {t("order.versions.changed")}
            </Badge>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}
