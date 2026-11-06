import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/common";
import { useWorkflowsHandedToMe } from "@/lib/api/generated/endpoints/workflows/workflows";
import { hasPermission, useSessionStore } from "@/stores/session";
import { QueryBoundary } from "./QueryBoundary";
import { TaskCard } from "./TaskCard";

/** The most the route gives. Nobody should hold anything like this many. */
const MAX_SHOWN = 200;

/**
 * SPRs the approval chain has handed to this person: standing in for someone
 * away, or passed up from below a limit. It belongs to the person, not their
 * role, so it shows above whichever inbox is open, and a role with no inbox of
 * its own still receives them. Most people have none, so it appears only when
 * there is something to say.
 */
export function HandedToYou() {
  const { t } = useTranslation("workflows");
  const session = useSessionStore((state) => state.session);
  const canOpen = hasPermission(session, "spr.read");
  const query = useWorkflowsHandedToMe({ pageSize: MAX_SHOWN });
  const tasks = query.data?.data ?? [];
  if (!query.isError && tasks.length === 0) return null;

  return (
    <SectionCard
      title={t("handed.title")}
      description={t("handed.description")}
    >
      <QueryBoundary query={query}>
        <ul className="space-y-s2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              touch={false}
              canOpen={canOpen}
              note={[
                t(`handed.reason.${task.handedOver.reason}`, {
                  name: task.handedOver.fromName,
                }),
                ...(task.handedOver.canAct
                  ? []
                  : [t(canOpen ? "handed.cannotDecide" : "handed.cannotOpen")]),
              ].join(" ")}
            />
          ))}
        </ul>
      </QueryBoundary>
    </SectionCard>
  );
}
