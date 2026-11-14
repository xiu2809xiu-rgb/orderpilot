import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiUsageTab } from "./AiUsageTab";
import { ClickstreamTab } from "./ClickstreamTab";
import { ObservabilityTab } from "./ObservabilityTab";

const TABS = [
  ["aiUsage", AiUsageTab],
  ["observability", ObservabilityTab],
  ["clickstream", ClickstreamTab],
] as const;

/** Area 4's monitoring base: real AI usage, and labelled mock observability and clickstream. */
export default function MonitoringPage() {
  const { t } = useTranslation("monitoring");
  return (
    <div className="space-y-s4">
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs defaultValue="aiUsage">
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
