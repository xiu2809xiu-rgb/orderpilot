import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTab } from "./ActivityTab";
import { ChecksTab } from "./ChecksTab";
import { DocumentsTab } from "./DocumentsTab";
import { documentsOf, withFlow, withPending } from "./documentsModel";
import { LinesTab } from "./LinesTab";
import { showSelectedTab } from "./showSelectedTab";
import { useOrderFlow } from "./useOrderFlow";
import { VersionsTab } from "./versions/VersionsTab";

const TABS = ["lines", "documents", "checks", "activity", "versions"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | null): value is Tab =>
  TABS.some((tab) => tab === value);

/**
 * Lines, Documents, Checks, Activity and Versions, each filled from the real data. The
 * tab is in the address (`tab=checks`), so a link opens the order on it. The
 * count beside a name is what its panel lists: lines, the documents the order
 * has (not the ones still to come), every check, and events. The Checks count
 * turns to an alert when one of them found a difference. Versions has no count:
 * it would need the list fetched before the tab is opened.
 */
export function OrderTabs({
  orderNo,
  detail,
  timeline,
  toConfirm,
  inWorkflow,
  typedHere,
}: {
  orderNo: string;
  detail: SalesOrderDetail | undefined;
  timeline: OrderTimeline;
  toConfirm: boolean;
  /** False for a draft or a void order, which the workflow does not know. */
  inWorkflow: boolean;
  /** A submitted order no team holds: it has no documents or checks to read. */
  typedHere: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const [params, setParams] = useSearchParams();
  // The workflow lists the documents received and still expected; a role that may not read it sees the ones the checks read.
  const flow = useOrderFlow(orderNo, inWorkflow).data?.data;
  // The documents tab invents a Customer PO row for an order, so an order with
  // no file of its own is given none and says so instead.
  const documents = typedHere
    ? []
    : withPending(
        withFlow(
          documentsOf(timeline.checks, { orderNo }),
          flow?.documents ?? [],
        ),
        flow,
      );
  // The demo PDFs print prices, so a role whose prices the server masks on this
  // page is not offered them, and the Checks tab covers its price checks by the
  // same test. Until the order has answered nothing is offered or shown.
  const amount = detail?.amount;
  const priceMask =
    amount && !amount.masked && amount.value !== null
      ? null
      : t(`mask.${amount?.reason ?? "price"}`);
  const asked = params.get("tab");
  const tab: Tab = isTab(asked) ? asked : "lines";
  const failed = timeline.checks.filter((check) => check.outcome !== "pass");
  const tabRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    showSelectedTab(tabRow.current);
  }, [tab]);
  const counts: Record<Exclude<Tab, "versions">, number> = {
    lines: detail?.lines.length ?? 0,
    documents: documents.filter((row) => !row.pending).length,
    checks: timeline.checks.length,
    activity: timeline.steps.length,
  };
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        const copy = new URLSearchParams(params);
        copy.set("tab", next);
        setParams(copy, { replace: true });
      }}
    >
      <TabsList
        ref={tabRow}
        aria-label={t("order.tabs.label")}
        className="od-tabs"
      >
        {TABS.map((id) => (
          <TabsTrigger key={id} value={id} className="od-tab">
            <span className="fs-14">{t(`order.tabs.${id}`)}</span>
            {/* An order the tracker does not know has no steps to count. */}
            {id === "versions" || (id === "activity" && !inWorkflow) ? null : (
              <span
                className="od-view-count numeral"
                data-alert={
                  id === "checks" && failed.length > 0 ? "" : undefined
                }
              >
                {counts[id]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="lines">
        {detail ? (
          <LinesTab detail={detail} />
        ) : (
          <p className="fs-14 text-muted-foreground">{t("order.lines.none")}</p>
        )}
      </TabsContent>
      <TabsContent value="documents">
        <DocumentsTab
          documents={documents}
          orderNo={orderNo}
          externalDocumentNo={timeline.externalDocumentNo}
          toConfirm={toConfirm}
          priceMask={priceMask}
          typedHere={typedHere}
        />
      </TabsContent>
      <TabsContent value="checks">
        <ChecksTab
          checks={timeline.checks}
          matches={timeline.matches}
          priceMask={priceMask}
          typedHere={typedHere}
          currentPoVersionNo={detail?.poVersionNo ?? null}
        />
      </TabsContent>
      <TabsContent value="activity">
        <ActivityTab orderNo={orderNo} steps={timeline.steps} />
      </TabsContent>
      <TabsContent value="versions">
        <VersionsTab orderNo={orderNo} />
      </TabsContent>
    </Tabs>
  );
}
