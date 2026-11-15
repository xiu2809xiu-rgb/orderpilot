import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiUsageTab } from "./AiUsageTab";
import { ClickstreamTab } from "./ClickstreamTab";
import { ObservabilityTab } from "./ObservabilityTab";

// Health first: it is what someone opening monitoring wants, and AI usage
// stays empty until the AI reads a document. (From Azri's #270.)
const TABS = [
  ["observability", ObservabilityTab],
  ["aiUsage", AiUsageTab],
  ["clickstream", ClickstreamTab],
] as const;

/**
 * Area 4's monitoring base: real AI usage, and labelled mock observability
 * and clickstream. The tab lives in the address bar, as on the governance
 * page, so a refresh or a shared link opens the same tab, and the AI use tile
 * can open the one it means (?tab=aiUsage).
 */
export default function MonitoringPage() {
  const { t } = useTranslation("monitoring");
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab = TABS.some(([id]) => id === asked)
    ? (asked ?? "observability")
    : "observability";
  return (
    <div className="space-y-s4">
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setParams({ tab: value }, { replace: true });
        }}
      >
        <TabsList aria-label={t("tabs.label")}>
          {TABS.map(([id]) => (
            <TabsTrigger key={id} value={id}>
              {t(`tabs.${id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(([id, Tab]) => (
          <TabsContent key={id} value={id}>
            <Tab />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
