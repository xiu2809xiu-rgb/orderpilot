import { useTranslation } from "react-i18next";
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
  return (
    <div className="space-y-s4">
      <PageHeader title={t("title")} description={t("description")} />
      <Tabs defaultValue="matrix">
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
