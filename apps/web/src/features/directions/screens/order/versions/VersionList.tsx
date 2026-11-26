import type { PoVersionSummary } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { formatDayTime } from "@/lib/format";
import { Amount } from "../../orders/Amount";
import { VersionLines } from "./VersionLines";

/** Who and when a PO version came in: version 1 is the draft, the rest were confirmed. */
function arrival(t: TFunction, version: PoVersionSummary): string {
  const when = formatDayTime(version.arrivedAt);
  const base = version.poVersionNo === 1 ? "draftStarted" : "confirmed";
  return version.arrivedBy === null
    ? t(`order.versions.${base}NoName`, { when })
    : t(`order.versions.${base}`, { when, who: version.arrivedBy });
}

function VersionRow({
  orderNo,
  version,
  currency,
}: {
  orderNo: string;
  version: PoVersionSummary;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const n = version.poVersionNo;
  return (
    <li className="space-y-s1 border-b py-s2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-s2 gap-y-s1">
        <h3 className="fs-14 font-medium text-foreground">
          {t("order.versions.row", { n })}
        </h3>
        <Badge variant={version.current ? "success" : "outline"} radius="full">
          {t(
            version.current
              ? "order.versions.current"
              : "order.versions.superseded",
          )}
        </Badge>
        <span className="fs-14 text-muted-foreground">
          {t("order.versions.lines", { count: version.lineCount })}
        </span>
        <Amount field={version.total} currency={currency} />
      </div>
      <p className="fs-14 text-muted-foreground">{arrival(t, version)}</p>
      {version.supersededAt === null ? null : (
        <p className="fs-14 text-muted-foreground">
          {t("order.versions.replaced", {
            next: n + 1,
            when: formatDayTime(version.supersededAt),
          })}
        </p>
      )}
      <button
        type="button"
        className="fs-14 inline-flex items-center gap-1 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t(
          open ? "order.versions.hideFor" : "order.versions.viewFor",
          {
            n,
          },
        )}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <ChevronDown
          aria-hidden="true"
          className={open ? "size-4 rotate-180" : "size-4"}
        />
        {t(open ? "order.versions.hide" : "order.versions.view")}
      </button>
      <div id={panelId} hidden={!open}>
        {open ? (
          <VersionLines orderNo={orderNo} poVersionNo={n} currency={currency} />
        ) : null}
      </div>
    </li>
  );
}

/** Every PO version of the order, newest first, each one able to open its lines. */
export function VersionList({
  orderNo,
  versions,
  currency,
}: {
  orderNo: string;
  versions: readonly PoVersionSummary[];
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <ul aria-label={t("order.versions.listLabel")}>
      {versions.map((version) => (
        <VersionRow
          key={version.poVersionNo}
          orderNo={orderNo}
          version={version}
          currency={currency}
        />
      ))}
    </ul>
  );
}
