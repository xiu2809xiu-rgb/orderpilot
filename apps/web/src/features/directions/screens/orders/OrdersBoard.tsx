import { Check, Clock, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollRegion } from "@/components/common";
import { SALES_STEP_IDS } from "../../data/estimates";
import { Badge } from "../../kit/Badge";
import { Frame, FrameHeader, FrameTitle } from "../../kit/Frame";
import { Amount } from "./Amount";
import { ALL_DONE, type OrderRow } from "./orderRow";

/** Cards a column shows before it offers the rest in the list. */
export const BOARD_CARDS = 8;

/**
 * The orders laid out by where they are in the nine steps, with the finished
 * ones in a last column. It is the same set as the list, under the same
 * filters, so nothing is counted twice or left out. A column that holds more
 * than it shows says how many more and opens them in the list; static
 * columns, because moving an order between steps is the workflow's decision,
 * never a drag.
 */
export function OrdersBoard({
  rows,
  onPeek,
  onOpenStep,
}: {
  rows: readonly OrderRow[];
  onPeek: (orderNo: string) => void;
  onOpenStep: (position: number) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tp } = useTranslation("directions-parts");
  const columns = useMemo(() => {
    const groups = Array.from({ length: ALL_DONE }, (): OrderRow[] => []);
    const unknown: OrderRow[] = [];
    for (const row of rows) {
      if (row.step === null) unknown.push(row);
      else groups[row.step - 1]?.push(row);
    }
    return { groups, unknown };
  }, [rows]);

  return (
    <ScrollRegion label={t("board.region")} className="od-board-scroll">
      <div className="od-board">
        {columns.groups.map((group, index) => {
          const position = index + 1;
          const done = position === ALL_DONE;
          const id = SALES_STEP_IDS[index];
          const title = done
            ? t("board.done")
            : tp(`journey.sales.${id ?? ""}`);
          return (
            <Column
              key={position}
              title={title}
              rows={group}
              onPeek={onPeek}
              onMore={
                done
                  ? null
                  : () => {
                      onOpenStep(position);
                    }
              }
            />
          );
        })}
        {columns.unknown.length > 0 ? (
          <Column
            title={t("board.notStarted")}
            rows={columns.unknown}
            onPeek={onPeek}
            onMore={null}
          />
        ) : null}
      </div>
    </ScrollRegion>
  );
}

function Column({
  title,
  rows,
  onPeek,
  onMore,
}: {
  title: string;
  rows: readonly OrderRow[];
  onPeek: (orderNo: string) => void;
  onMore: (() => void) | null;
}) {
  const { t } = useTranslation("directions-orders");
  const shown = rows.slice(0, BOARD_CARDS);
  const more = rows.length - shown.length;
  return (
    <section className="od-column" aria-label={title}>
      <Frame className="h-full">
        <FrameHeader className="od-column-head">
          <FrameTitle className="flex items-center justify-between gap-2">
            <span className="truncate">{title}</span>
            <span className="numeral od-column-count">{rows.length}</span>
          </FrameTitle>
        </FrameHeader>
        {shown.length === 0 ? (
          <p className="od-column-empty fs-14">{t("board.empty")}</p>
        ) : (
          <ul className="od-cards">
            {shown.map((row) => (
              <li key={row.orderNo}>
                <Card row={row} onPeek={onPeek} />
              </li>
            ))}
          </ul>
        )}
        {more > 0 ? (
          <button
            type="button"
            className="od-more fs-14"
            onClick={onMore ?? undefined}
            disabled={onMore === null}
          >
            {t("board.more", { count: more })}
          </button>
        ) : null}
      </Frame>
    </section>
  );
}

function Card({
  row,
  onPeek,
}: {
  row: OrderRow;
  onPeek: (orderNo: string) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const late = row.overdue?.overdue === true ? row.overdue : null;
  return (
    <div className="od-card">
      <span className="od-card-top">
        {/* The number is the button; its ::after stretches over the whole card,
            and the value stays above it so a mask can still show its reason. */}
        <button
          type="button"
          className="od-card-open numeral fs-14 font-medium"
          onClick={() => {
            onPeek(row.orderNo);
          }}
        >
          {row.orderNo}
        </button>
        <span className="od-card-flags">
          {row.openExceptions > 0 ? (
            <Badge
              variant="destructive"
              size="sm"
              aria-label={t("cells.exceptions", { count: row.openExceptions })}
            >
              <TriangleAlert aria-hidden="true" />
              {row.openExceptions}
            </Badge>
          ) : null}
          {late ? (
            <Badge variant="destructive" size="sm">
              <Clock aria-hidden="true" />
              {t("cells.late", { count: late.daysOverdue })}
            </Badge>
          ) : null}
          {row.toConfirm ? (
            <Badge variant="info" size="sm">
              <Check aria-hidden="true" />
              {t("cells.toConfirm")}
            </Badge>
          ) : null}
        </span>
      </span>
      <span className="od-card-customer fs-14">
        {row.customerName ?? row.customerNo}
      </span>
      <span className="od-card-value fs-14">
        <Amount field={row.amount} currency={row.currencyCode} />
      </span>
    </div>
  );
}
