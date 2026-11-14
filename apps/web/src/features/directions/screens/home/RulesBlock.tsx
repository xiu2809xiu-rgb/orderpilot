import { ArrowRight, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { StatusChip } from "@/components/kit/StatusChip";
import { Button } from "@/components/ui/button";
import { BlockSection } from "./BlockSection";
import { HomeRow } from "./HomeRow";
import type { useBlockQueries } from "./useBlockQueries";

/**
 * The system administrator's block: the business rules that stay
 * configuration until Spectra confirms them, each with today's draft value. A
 * rule that has a screen opens it; one that has none is marked as held in
 * configuration, so no button leads nowhere.
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
        const name = tHome(`rules.names.${rule.id}`);
        return (
          <HomeRow
            title={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {name}
                {rule.screen ? null : (
                  <StatusChip kind="info" icon={Settings2}>
                    {tHome("rules.noScreen")}
                  </StatusChip>
                )}
              </span>
            }
            meta={<span className="min-w-0">{rule.value}</span>}
            action={
              rule.screen ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full pointer-coarse:min-h-11"
                >
                  <Link
                    to={rule.screen}
                    aria-label={t("block.actionOn", {
                      action: tHome("rules.open"),
                      record: name,
                    })}
                  >
                    {tHome("rules.open")}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : null
            }
          />
        );
      }}
    />
  );
}
