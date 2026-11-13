import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ErrorPanel, ScrollRegion } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";
import { formatDay, todayInSingapore } from "@/lib/format";
import { useDirection } from "../../frame/useDirection";
import { orderHref } from "../home/homeLinks";
import { OrderJourney } from "../order/OrderJourney";
import { ShipLine } from "../order/ShipLine";
import { useOrderJourney } from "../order/useOrderJourney";
import { Amount } from "./Amount";
import { ageInDays, ALL_DONE, type OrderRow } from "./orderRow";

/**
 * The side peek: one order's journey beside the list, so a person can see
 * where it stands without leaving. Up and Down step through the orders in
 * view, and Open order goes to the page. It reads the order's own timeline,
 * so who finished a step and when are the real events.
 */
export function OrderPeek({
  row,
  position,
  total,
  onStep,
  onClose,
  roleLabel,
}: {
  row: OrderRow | null;
  position: number;
  total: number;
  onStep: (delta: -1 | 1) => void;
  onClose: () => void;
  roleLabel: (role: NonNullable<OrderRow["ownerRole"]>) => string;
}) {
  const { t } = useTranslation("directions-orders");
  const direction = useDirection();
  const { timeline, journey } = useOrderJourney(row?.orderNo ?? null);
  const notInTracker =
    timeline.error instanceof ApiError && timeline.error.code === "NOT_FOUND";
  return (
    <Sheet
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="od-peek dx-panel-strong gap-0 p-0 sm:max-w-[30rem]">
        {row ? (
          <>
            <SheetHeader className="od-peek-head">
              <SheetTitle className="numeral fs-20">{row.orderNo}</SheetTitle>
              <SheetDescription className="fs-14">
                {row.customerName ?? row.customerNo}
              </SheetDescription>
              <div className="od-peek-step">
                <span className="numeral fs-13 text-muted-foreground">
                  {t("peek.position", { position, total })}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="pointer-coarse:size-11"
                  aria-label={t("peek.previous")}
                  disabled={position <= 1}
                  onClick={() => {
                    onStep(-1);
                  }}
                >
                  <ChevronUp aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="pointer-coarse:size-11"
                  aria-label={t("peek.next")}
                  disabled={position >= total}
                  onClick={() => {
                    onStep(1);
                  }}
                >
                  <ChevronDown aria-hidden="true" />
                </Button>
              </div>
            </SheetHeader>
            <ScrollRegion label={t("peek.region")} className="od-peek-body">
              <dl className="od-facts fs-14">
                <Fact label={t("peek.status")}>
                  {row.status?.label ??
                    row.workflowStatus ??
                    t("cells.notStarted")}
                </Fact>
                <Fact label={t("columns.heldAt")}>
                  {row.ownerRole && row.step !== ALL_DONE
                    ? roleLabel(row.ownerRole)
                    : t("cells.done")}
                </Fact>
                <Fact label={t("columns.age")}>
                  {t("cells.days", {
                    count: ageInDays(row.orderDate, todayInSingapore()),
                  })}
                </Fact>
                <Fact label={t("columns.shipDate")}>
                  {row.shipmentDate
                    ? formatDay(row.shipmentDate)
                    : t("cells.notSet")}
                </Fact>
                <Fact label={t("columns.value")}>
                  <Amount field={row.amount} currency={row.currencyCode} />
                </Fact>
                <Fact label={t("columns.po")}>
                  <span className="numeral">{row.externalDocumentNo}</span>
                </Fact>
              </dl>
              <h3 className="od-peek-title fs-14">{t("peek.journey")}</h3>
              {timeline.isPending ? (
                <div className="space-y-3" aria-hidden="true">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-40" />
                </div>
              ) : notInTracker || !journey ? (
                <p className="fs-14 text-muted-foreground">
                  {t("peek.noJourney")}
                </p>
              ) : timeline.isError ? (
                <ErrorPanel
                  error={timeline.error}
                  onRetry={() => void timeline.refetch()}
                />
              ) : (
                <>
                  <ShipLine journey={journey} shipmentDate={row.shipmentDate} />
                  <OrderJourney
                    journey={journey}
                    size="vertical"
                    late={row.overdue?.overdue === true}
                  />
                </>
              )}
            </ScrollRegion>
            <SheetFooter className="od-peek-foot">
              <Button asChild className="pointer-coarse:h-11">
                <Link to={orderHref(direction, row.orderNo)}>
                  {t("peek.open")}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

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
