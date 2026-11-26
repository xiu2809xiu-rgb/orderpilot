import { useTranslation } from "react-i18next";
import { formatDay, todayInSingapore } from "@/lib/format";
import { Amount } from "./Amount";
import { EntryChip } from "./EntryChip";
import { heldAtOf, heldAtWords } from "./heldAt";
import { StockCell } from "./OrderFigures";
import { ageInDays, stageWordKey, type OrderRow } from "./orderRow";

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="od-fact">
      <dt className="fs-12 text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The peek's facts: the status, who holds the order, its age, dates, value, PO and stock. */
export function PeekFacts({
  row,
  roleLabel,
}: {
  row: OrderRow;
  roleLabel: (role: NonNullable<OrderRow["ownerRole"]>) => string;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <dl className="od-facts fs-14">
      <Fact label={t("peek.status")}>
        {row.status?.label ?? row.workflowStatus ?? t(stageWordKey(row))}
      </Fact>
      <Fact label={t("columns.heldAt")}>
        {heldAtWords(heldAtOf(row), t, roleLabel)}
      </Fact>
      <Fact label={t("columns.age")}>
        {t("cells.days", {
          count: ageInDays(row.orderDate, todayInSingapore()),
        })}
      </Fact>
      <Fact label={t("columns.shipDate")}>
        {row.shipmentDate ? formatDay(row.shipmentDate) : t("cells.notSet")}
      </Fact>
      <Fact label={t("columns.value")}>
        <Amount field={row.amount} currency={row.currencyCode} />
      </Fact>
      <Fact label={t("columns.po")}>
        <span className="numeral">{row.externalDocumentNo}</span>
      </Fact>
      {row.source === "stored" && row.captureState ? (
        <Fact label={t("columns.entry")}>
          <EntryChip state={row.captureState} />
        </Fact>
      ) : null}
      {row.shortage ? (
        <Fact label={t("columns.stock")}>
          <StockCell row={row} />
        </Fact>
      ) : null}
    </dl>
  );
}
