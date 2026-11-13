import type { WorkflowTask } from "@orderpilot/shared";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedList } from "@/components/kit/AnimatedList";
import { EmptyState } from "@/components/parts/EmptyState";
import { Section } from "@/components/parts/Section";
import { NeedRow } from "./NeedRow";
import type { useCompleteTask } from "./useCompleteTask";
import type { useHomeTasks } from "./useHomeTasks";

/** Tasks listed in Needs you; the rest are counted. */
const SHOWN = 8;

/**
 * The first section of home: the person's open tasks, most urgent first, each
 * with its timer. The rows arrive once when the screen is first seen, then
 * stay still: a list someone works in never moves.
 */
export function NeedsYou({
  home,
  completion,
}: {
  home: ReturnType<typeof useHomeTasks>;
  completion: ReturnType<typeof useCompleteTask>;
}) {
  const { t } = useTranslation("directions-home");
  const shown = home.tasks.slice(0, SHOWN);
  const hidden = Math.max(0, home.total - shown.length);

  return (
    <Section title={t("needs.title")} work className="min-w-0">
      {home.list.isPending ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : home.list.isError ? (
        <p role="alert" className="fs-14 text-destructive">
          {t("needs.failed")}
        </p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("needs.empty.title")}
          description={t("needs.empty.description")}
        />
      ) : (
        <>
          <AnimatedList>
            {shown.map((task: WorkflowTask) => (
              <NeedRow
                key={task.id}
                task={task}
                busy={completion.isBusy(task)}
                onComplete={() => {
                  completion.complete(task);
                }}
              />
            ))}
          </AnimatedList>
          {hidden > 0 ? (
            <p className="fs-14 pt-3 text-muted-foreground">
              {t("needs.more", { count: hidden })}
            </p>
          ) : null}
        </>
      )}
    </Section>
  );
}
