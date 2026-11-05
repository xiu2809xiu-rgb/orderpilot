import { taskKindSchema, type InboxRole } from "@orderpilot/shared";
import type { WorkflowTask } from "@orderpilot/shared";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  RecordLink,
  StatusBadge,
  useUrlQuery,
  type DataTableColumn,
} from "@/components/common";
import {
  ListPage,
  type ListAction,
  type ListFilter,
} from "@/components/list-page";
import {
  useWorkflowsInboxTasks,
  useWorkflowsMyTasks,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatDate } from "./format";
import { RecordRefLine } from "./RecordRefLine";

const URL_FILTERS = { kind: taskKindSchema.options, overdue: null };
const READ = [
  { id: "export", kind: "export", permission: "workflows.read" },
  { id: "print", kind: "print", permission: "workflows.read" },
] satisfies ListAction<WorkflowTask>[];

/** Where a task's one action goes: the SPR for an SPR task, the order for the rest. */
function targetOf(task: WorkflowTask): string | undefined {
  if (task.ref) return `/workflows/sprs/${task.ref.recordNo}`;
  return task.orderNo ? `/workflows/orders/${task.orderNo}` : undefined;
}

interface InboxListProps {
  role: InboxRole;
  /** True for a role that picks whose inbox to read: it asks the inbox route. */
  mayPick: boolean;
  /** The workflow links and the role picker, drawn under the title. */
  above: ReactNode;
}

/** A role's task inbox as the shared list: kind, overdue and search in the link. */
export function InboxList({ role, mayPick, above }: InboxListProps) {
  const { t } = useTranslation("workflows");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useUrlQuery(URL_FILTERS);
  const params = {
    page: query.page,
    pageSize: query.pageSize,
    ...(query.filters.overdue === true ? { overdue: "true" as const } : {}),
    ...(typeof query.filters.kind === "string"
      ? { kind: taskKindSchema.parse(query.filters.kind) }
      : {}),
  };
  const mine = useWorkflowsMyTasks(params, {
    query: { enabled: !mayPick, placeholderData: (previous) => previous },
  });
  const theirs = useWorkflowsInboxTasks(role, params, {
    query: { enabled: mayPick, placeholderData: (previous) => previous },
  });
  const list = mayPick ? theirs : mine;

  const columns = useMemo<DataTableColumn<WorkflowTask>[]>(
    () => [
      {
        id: "kind",
        header: t("inbox.columns.kind"),
        cell: (task) => t(`task.kinds.${task.kind}`),
        exportValue: (task) => t(`task.kinds.${task.kind}`),
      },
      {
        id: "title",
        header: t("inbox.columns.title"),
        wrap: true,
        hideable: false,
        cell: (task) => {
          const target = targetOf(task);
          return target ? (
            <RecordLink
              to={target}
              className="inline-flex min-h-6 items-center font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
            >
              {task.title}
            </RecordLink>
          ) : (
            task.title
          );
        },
        exportValue: (task) => task.title,
      },
      {
        id: "order",
        header: t("task.order"),
        cell: (task) => (
          <span data-numeric className="font-mono">
            {task.orderNo ?? ""}
          </span>
        ),
        exportValue: (task) => task.orderNo ?? "",
      },
      {
        id: "request",
        header: t("task.request"),
        cell: (task) => (task.ref ? <RecordRefLine value={task.ref} /> : null),
        exportValue: (task) => task.ref?.recordNo ?? "",
      },
      {
        id: "due",
        header: t("inbox.columns.due"),
        cell: (task) => formatDate(task.dueAt),
        exportValue: (task) => formatDate(task.dueAt),
      },
      {
        id: "overdue",
        header: t("task.overdue"),
        cell: (task) =>
          task.overdue ? (
            <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
          ) : (
            t("task.onTime")
          ),
        exportValue: (task) => (task.overdue ? t("task.overdue") : ""),
      },
    ],
    [t],
  );

  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "kind",
        label: t("inbox.columns.kind"),
        allLabel: t("inbox.allKinds"),
        options: taskKindSchema.options.map((kind) => ({
          value: kind,
          label: t(`task.kinds.${kind}`),
        })),
      },
      { id: "overdue", label: t("inbox.overdueOnly"), kind: "toggle" },
    ],
    [t],
  );

  return (
    <ListPage
      tableId="workflows-inbox"
      title={t("inbox.heading")}
      description={
        mayPick ? t("inbox.otherDescription") : t("inbox.ownDescription")
      }
      demo="mock"
      tabs={above}
      caption={t("inbox.forRole", { role: tc(`roles.${role}`) })}
      columns={columns}
      rowKey={(task) => task.id}
      rowLabel={(task) => task.title}
      rowHref={(task) => targetOf(task) ?? "/workflows"}
      query={query}
      onQueryChange={setQuery}
      list={list}
      filters={filters}
      actions={READ}
      operationLog={{ entityType: "WorkflowTask", entityId: (task) => task.id }}
      empty={{
        title: t("inbox.emptyTitle"),
        description: t("inbox.emptyDescription"),
      }}
    />
  );
}
