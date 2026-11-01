import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiTab } from "./AiTab";
import { MaskingTab } from "./MaskingTab";
import { MatrixTab } from "./MatrixTab";
import { RefusalsTab } from "./RefusalsTab";
import { UsersTab } from "./UsersTab";

const TABS = [
  ["matrix", MatrixTab],
  ["users", UsersTab],
  ["masking", MaskingTab],
  ["ai", AiTab],
  ["refusals", RefusalsTab],
] as const;

/** Area 4's base: the live matrix, users, masking, data sent to AI, and refusals. */
export default function GovernancePage() {
  const { t } = useTranslation("governance");
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab = TABS.some(([id]) => id === asked)
    ? (asked ?? "matrix")
    : "matrix";
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
