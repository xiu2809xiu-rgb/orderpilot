import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTab } from "./ActivityTab";
import { ChecksTab } from "./ChecksTab";
import { DocumentsTab } from "./DocumentsTab";
import { documentsOf } from "./documentsModel";
import { LinesTab } from "./LinesTab";

const TABS = ["lines", "documents", "checks", "activity"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | null): value is Tab =>
  TABS.some((tab) => tab === value);

/**
 * Lines, Documents, Checks and Activity, each filled from the real data. The
 * tab is in the address (`tab=checks`), so a link opens the order on it. The
 * count beside a name is what is inside: lines, documents, checks that found a
 * difference (or all checks when none did) and events.
 */
export function OrderTabs({
  orderNo,
  detail,
  timeline,
  toConfirm,
}: {
  orderNo: string;
  detail: SalesOrderDetail | undefined;
  timeline: OrderTimeline;
  toConfirm: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab: Tab = isTab(asked) ? asked : "lines";
  const failed = timeline.checks.filter((check) => check.outcome !== "pass");
  const counts: Record<Tab, number> = {
    lines: detail?.lines.length ?? 0,
    documents: documentsOf(timeline.checks, { orderNo }).length,
    checks: failed.length > 0 ? failed.length : timeline.checks.length,
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
      <TabsList aria-label={t("order.tabs.label")} className="od-tabs">
        {TABS.map((id) => (
          <TabsTrigger key={id} value={id} className="od-tab">
            <span className="fs-14">{t(`order.tabs.${id}`)}</span>
            <span
              className="od-view-count numeral"
              data-alert={id === "checks" && failed.length > 0 ? "" : undefined}
            >
              {counts[id]}
            </span>
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
          checks={timeline.checks}
          orderNo={orderNo}
          externalDocumentNo={timeline.externalDocumentNo}
          toConfirm={toConfirm}
        />
      </TabsContent>
      <TabsContent value="checks">
        <ChecksTab checks={timeline.checks} matches={timeline.matches} />
      </TabsContent>
      <TabsContent value="activity">
        <ActivityTab steps={timeline.steps} />
      </TabsContent>
    </Tabs>
  );
}
