import { operationLogReader } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { SelectedLog } from "@/components/list-page/RecordLogPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission, useSessionStore } from "@/stores/session";
import { TabLabel } from "./TabLabel";
import { TabPanel } from "./TabPanel";
import type { DocumentTabsSpec } from "./types";

const PLAIN = ["timeline", "checks", "documents"] as const;

interface DocumentTabsProps {
  spec: DocumentTabsSpec;
  /** The document's number, for the log's title. */
  label: string;
}

/**
 * Below the form: Timeline, Checks, Documents and Operation log. Each tab
 * names how many items need attention and has a compact empty state. The log
 * tab is drawn only for a role that may read this kind of record, and asks the
 * server for its lines only once it is opened.
 */
export function DocumentTabs({ spec, label }: DocumentTabsProps) {
  const { t } = useTranslation("document-form");
  const allowed = useSessionStore((state) => {
    const reader = operationLogReader(spec.log?.entityType);
    return reader !== undefined && hasPermission(state.session, reader);
  });
  const { log } = spec;
  return (
    <Tabs defaultValue="timeline">
      {/* The label goes on the element with role="tablist", not on the root div. */}
      <TabsList className="max-w-full" aria-label={t("tabs.label")}>
        {PLAIN.map((key) => (
          <TabsTrigger key={key} value={key} className="pointer-coarse:h-11">
            <TabLabel name={t(`tabs.${key}`)} count={spec[key].count ?? 0} />
          </TabsTrigger>
        ))}
        {allowed ? (
          <TabsTrigger value="log" className="pointer-coarse:h-11">
            {t("tabs.log")}
          </TabsTrigger>
        ) : null}
      </TabsList>
      {PLAIN.map((key) => (
        <TabsContent key={key} value={key}>
          <TabPanel
            content={spec[key].content}
            empty={spec[key].emptyText ?? t(`tabs.empty.${key}`)}
          />
        </TabsContent>
      ))}
      {allowed && log ? (
        <TabsContent value="log">
          <SelectedLog<string>
            spec={{ entityType: log.entityType, entityId: (id) => id }}
            entityId={log.entityId}
            label={label}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
