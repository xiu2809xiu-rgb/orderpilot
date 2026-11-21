import type { Permission } from "@orderpilot/shared";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission, useSessionStore } from "@/stores/session";
import { AiTab } from "./AiTab";
import { MaskingTab } from "./MaskingTab";
import { MatrixTab } from "./MatrixTab";
import { RefusalsTab } from "./RefusalsTab";
import { UsersTab } from "./UsersTab";

/**
 * The tabs, each with what it needs beyond opening the page (roles.read). A
 * role sees only the tabs it may use, so it meets no dead end. Hiding a tab
 * is not the control: the server refuses each route on its own.
 */
const TABS: readonly (readonly [string, ComponentType, Permission | null])[] = [
  ["matrix", MatrixTab, null],
  ["users", UsersTab, "users.read"],
  ["masking", MaskingTab, null],
  ["ai", AiTab, null],
  ["refusals", RefusalsTab, null],
];

/** Area 4's base: the live matrix, users, masking, data sent to AI, and refusals. */
export default function GovernancePage() {
  const { t } = useTranslation("governance");
  const session = useSessionStore((state) => state.session);
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter(
    ([, , needs]) => needs === null || hasPermission(session, needs),
  );
  const asked = params.get("tab");
  const tab = tabs.some(([id]) => id === asked)
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
          {tabs.map(([id]) => (
            <TabsTrigger key={id} value={id}>
              {t(`tabs.${id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(([id, Tab]) => (
          <TabsContent key={id} value={id}>
            <Tab />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
