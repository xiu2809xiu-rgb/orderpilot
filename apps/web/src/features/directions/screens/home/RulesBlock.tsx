import { CircleCheck, CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/kit/StatusChip";
import { BlockSection } from "./BlockSection";
import { HomeRow } from "./HomeRow";
import type { useBlockQueries } from "./useBlockQueries";

/**
 * The system administrator's block: the business rules, what Spectra settled at
 * the 5 Nov briefing beside the drafts that still wait for its answer, each
 * with the value we hold. Each stays a setting, so no row leads to a screen.
 */
export function RulesBlock({
  query,
}: {
  query: ReturnType<typeof useBlockQueries>["rules"];
}) {
  const { t } = useTranslation("directions-home");
  const { t: tHome } = useTranslation("home");
  const rules = query.data?.data ?? [];
  return (
    <BlockSection
      title={tHome("rules.title")}
      intro={tHome("rules.description")}
      query={query}
      items={rules}
      itemKey={(rule) => rule.id}
      empty={{
        title: t("block.rules.emptyTitle"),
        description: t("block.rules.emptyDescription"),
      }}
      row={(rule) => {
        const confirmed = rule.status === "confirmed";
        return (
          <HomeRow
            title={tHome(`rules.names.${rule.id}`)}
            meta={<span className="min-w-0">{rule.value}</span>}
            action={
              <StatusChip
                kind={confirmed ? "success" : "warning"}
                icon={confirmed ? CircleCheck : CircleDashed}
              >
                {tHome(`rules.status.${rule.status}`)}
              </StatusChip>
            }
          />
        );
      }}
    />
  );
}
