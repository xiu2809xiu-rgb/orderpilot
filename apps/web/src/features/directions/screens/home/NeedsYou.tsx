import type { WorkflowTask } from "@orderpilot/shared";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AnimatedList } from "@/components/kit/AnimatedList";
import { EmptyState } from "@/components/parts/EmptyState";
import { HomeSection } from "./HomeSection";
import { HomeQuery } from "./HomeQuery";
import { NeedRow } from "./NeedRow";
import { RowSkeletons } from "./RowSkeletons";
import type { useCompleteTask } from "./useCompleteTask";
import type { useHomeTasks } from "./useHomeTasks";
import type { useNeedFocus } from "./useNeedFocus";

/** Tasks listed in Needs you; the rest are counted and the inbox holds them. */
const SHOWN = 8;

/**
 * The first section of home for a role with an inbox: its open tasks, earliest
 * due first (`byDueTime`), so the longest overdue is first, each with its timer and one action. The rows arrive once when
 * the screen is first seen, then stay still: a list someone works in never
 * moves. Past eight tasks the rest are counted, with a link to the inbox.
 */
export function NeedsYou({
  home,
  completion,
  focus,
}: {
  home: ReturnType<typeof useHomeTasks>;
  completion: ReturnType<typeof useCompleteTask>;
  focus: ReturnType<typeof useNeedFocus>;
}) {
  const { t } = useTranslation("directions-home");
  const shown = home.tasks.slice(0, SHOWN);
  const hidden = Math.max(0, home.total - shown.length);

  return (
    <HomeSection title={t("needs.title")} work className="min-w-0">
      <div ref={focus.listRef}>
        <HomeQuery query={home.list} loading={<RowSkeletons />}>
          {shown.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t("needs.empty.title")}
              description={t("needs.empty.description")}
            />
          ) : (
            <>
              <AnimatedList
                stagger={0.03}
                className="-my-3 divide-y divide-border"
              >
                {shown.map((task: WorkflowTask, index) => (
                  <NeedRow
                    key={task.id}
                    task={task}
                    busy={completion.isBusy(task)}
                    onComplete={() => {
                      focus.followNext(task, index);
                      completion.complete(task);
                    }}
                  />
                ))}
              </AnimatedList>
              {hidden > 0 ? (
                <p className="fs-14 mt-4 flex flex-wrap items-center justify-between gap-x-4 border-t border-border pt-3 text-muted-foreground">
                  {t("needs.more", { count: hidden })}
                  <Link
                    to="/workflows"
                    className="inline-flex items-center font-medium text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
                  >
                    {t("needs.viewAll", { total: home.total })}
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </HomeQuery>
      </div>
    </HomeSection>
  );
}
