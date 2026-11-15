import { Columns3, Inbox, ListTree, OctagonAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VIEWS, type View, type ViewCounts } from "./ordersQuery";

const ICON = {
  all: ListTree,
  mine: Inbox,
  held: OctagonAlert,
  stage: Columns3,
} as const satisfies Record<View, unknown>;

/**
 * The four views across the top of the workspace. Each shows how many orders
 * it holds under the filters in force, so a number is what the tab opens. By
 * stage is the same orders laid out as a board, so it carries no count of its
 * own, and none shows until the list has answered. Needs me is left out for a role that holds no tasks: it would always
 * be empty.
 */
export function OrdersViews({
  view,
  counts,
  showMine,
  onChange,
}: {
  view: View;
  /** Null while the list has not answered: a count of nothing would say there are no orders. */
  counts: ViewCounts | null;
  showMine: boolean;
  onChange: (view: View) => void;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        onChange(next as View);
      }}
    >
      <TabsList aria-label={t("views.label")} className="od-views">
        {VIEWS.filter((id) => id !== "mine" || showMine).map((id) => {
          const Icon = ICON[id];
          return (
            // No tab panel exists (the list below is shared by every view),
            // so the trigger's own `aria-controls` would point nowhere.
            <TabsTrigger
              key={id}
              value={id}
              aria-controls={undefined}
              className="od-view"
            >
              <span className="od-view-name fs-14">
                <Icon aria-hidden="true" className="size-4" />
                {t(`views.${id}`)}
              </span>
              {id === "stage" || counts === null ? null : (
                <span className="od-view-count numeral">{counts[id]}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
