import { areaOption } from "./catalogue.mjs";
import { allSprints, sprintDates, sprintTitle } from "./sprint-calendar.mjs";

export const BOARD_TITLE = "OrderPilot delivery";
export const BOARD_DESCRIPTION =
  "OrderPilot's delivery board, kept as code in scripts/github.";

// Project 2 is an abandoned board, once titled like this one and now
// "OrderPilot delivery (port attempt)" and closed, holding another repository's
// items. That is why the board is only ever found through this repository's
// links and never by title among the owner's projects, and why this number is
// refused even if someone links it here by mistake.
export const ABANDONED_PROJECT_NUMBER = 2;

const SPRINT_DAYS = 7;
const AREA_COLOURS = ["BLUE", "PURPLE", "YELLOW", "RED", "GRAY"];

// A new project's Status has Todo, In Progress and Done. Ready sits between
// Todo and In Progress: refined and free to pull, but not started.
export const READY = "Ready";
const READY_OPTION = {
  name: READY,
  color: "BLUE",
  description: "Refined and ready to pull",
};

export const VIEWS = [
  {
    name: "Backlog",
    layout: "TABLE_LAYOUT",
    filter: "-status:Done",
    fields: ["Title", "Status", "Sprint", "Estimate", "Area", "Assignees"],
  },
  {
    name: "Sprint",
    layout: "BOARD_LAYOUT",
    filter: "sprint:@current",
    fields: ["Title", "Status", "Assignees", "Estimate", "Area"],
  },
];

// A new project opens on one table called "View 1". Renaming it to the first
// view leaves no stray view behind.
const DEFAULT_VIEW = "View 1";

const LINKED_PROJECTS = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    owner { id }
    projectsV2(first: 20) { nodes { id number title closed url } }
  }
}`;

const BOARD_SHAPE = `query($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      number
      shortDescription
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2FieldCommon { id name dataType }
          ... on ProjectV2SingleSelectField { options { id name color description } }
          ... on ProjectV2IterationField {
            configuration {
              iterations { id title startDate duration }
              completedIterations { id title startDate duration }
            }
          }
        }
      }
      views(first: 30) { nodes { id name layout filter } }
    }
  }
}`;

const BOARD_ITEMS = `query($id: ID!, $cursor: String) {
  node(id: $id) {
    ... on ProjectV2 {
      number
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content {
            __typename
            ... on Issue { id number }
            ... on PullRequest { id number }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          area: fieldValueByName(name: "Area") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          estimate: fieldValueByName(name: "Estimate") {
            ... on ProjectV2ItemFieldNumberValue { number }
          }
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue { title }
          }
        }
      }
    }
  }
}`;

function refuseAbandoned(number) {
  if (number === ABANDONED_PROJECT_NUMBER) {
    throw new Error(
      `Project ${number} is the abandoned board and stays untouched.`,
    );
  }
}

export function pickBoard(linkedProjects) {
  const matches = linkedProjects.filter(
    (project) =>
      project.title === BOARD_TITLE &&
      !project.closed &&
      project.number !== ABANDONED_PROJECT_NUMBER,
  );
  if (matches.length > 1) {
    const numbers = matches.map((project) => `#${project.number}`).join(", ");
    throw new Error(
      `More than one open "${BOARD_TITLE}" is linked to this repository: ${numbers}.`,
    );
  }
  return matches[0] ?? null;
}

// A closed board is still the board. Making a fresh one beside it would break
// "a second run creates nothing", so the sync stops and says so instead.
export function closedBoard(linkedProjects) {
  return (
    linkedProjects.find(
      (project) =>
        project.title === BOARD_TITLE &&
        project.closed &&
        project.number !== ABANDONED_PROJECT_NUMBER,
    ) ?? null
  );
}

export async function readRepository(github) {
  const { repository } = await github.query(LINKED_PROJECTS, {
    owner: github.owner,
    name: github.name,
  });
  return {
    id: repository.id,
    ownerId: repository.owner.id,
    projects: repository.projectsV2.nodes,
  };
}

export async function findBoard(github) {
  return pickBoard((await readRepository(github)).projects);
}

export async function readBoardShape(github, board) {
  refuseAbandoned(board.number);
  const { node } = await github.query(BOARD_SHAPE, { id: board.id });
  refuseAbandoned(node.number);
  return {
    shortDescription: node.shortDescription ?? "",
    fields: node.fields.nodes,
    views: node.views.nodes,
  };
}

export async function readBoardItems(github, board) {
  refuseAbandoned(board.number);
  const items = [];
  let cursor = null;
  do {
    const { node } = await github.query(BOARD_ITEMS, { id: board.id, cursor });
    refuseAbandoned(node.number);
    const page = node.items;
    items.push(
      ...page.nodes.map((item) => ({
        id: item.id,
        contentId: item.content?.id ?? null,
        number: item.content?.number ?? null,
        status: item.status?.name ?? null,
        area: item.area?.name ?? null,
        estimate: item.estimate?.number ?? null,
        sprint: item.sprint?.title ?? null,
      })),
    );
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return items;
}

export function wantedIterations() {
  return allSprints().map((sprint) => ({
    title: sprintTitle(sprint),
    startDate: sprintDates(sprint).monday,
    duration: SPRINT_DAYS,
  }));
}

export function iterationConfiguration(existing = []) {
  const byStart = new Map(existing.map((item) => [item.startDate, item]));
  return {
    startDate: sprintDates(1).monday,
    duration: SPRINT_DAYS,
    iterations: wantedIterations().map((iteration) => {
      const id = byStart.get(iteration.startDate)?.id;
      return id ? { id, ...iteration } : iteration;
    }),
  };
}

// GitHub moves an iteration to `completedIterations` once it ends. Comparing
// `iterations` alone would make a finished sprint look missing, and rewriting
// the field for that would churn every run from Sprint 2 on.
export function configuredIterations(field) {
  const { iterations, completedIterations } = field.configuration;
  return [...iterations, ...completedIterations].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
}

export function iterationsMatch(field) {
  const configured = configuredIterations(field);
  const wanted = wantedIterations();
  return (
    configured.length === wanted.length &&
    wanted.every(
      (iteration, index) =>
        configured[index].title === iteration.title &&
        configured[index].startDate === iteration.startDate &&
        configured[index].duration === iteration.duration,
    )
  );
}

export function wantedAreaOptions(labels) {
  return labels
    .filter((label) => label.name.startsWith("area: "))
    .map((label, index) => ({
      name: areaOption(label.name),
      color: AREA_COLOURS[index],
      description: label.description,
    }));
}

export function areaOptionsMatch(field, wanted) {
  const names = field.options.map((option) => option.name);
  return (
    names.length === wanted.length &&
    wanted.every((option, index) => option.name === names[index])
  );
}

// The existing options keep their ids, so no item loses the Status it has.
export function statusOptionsWithReady(options) {
  const kept = options.map(({ id, name, color, description }) => ({
    id,
    name,
    color,
    description: description ?? "",
  }));
  const todo = kept.findIndex((option) => option.name === "Todo");
  kept.splice(todo + 1, 0, READY_OPTION);
  return kept;
}

export function planFields(fields, labels) {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const actions = [];
  const need = (name, dataType) => {
    const field = byName.get(name);
    if (field && field.dataType !== dataType) {
      throw new Error(
        `The board's ${name} field is ${field.dataType}, not ${dataType}. Fix it by hand.`,
      );
    }
    return field;
  };

  const status = need("Status", "SINGLE_SELECT");
  if (!status) {
    throw new Error("The board has no Status field. Fix it by hand.");
  }
  if (!status.options.some((option) => option.name === READY)) {
    actions.push({
      type: "update-status",
      field: status,
      options: statusOptionsWithReady(status.options),
    });
  }

  const sprint = need("Sprint", "ITERATION");
  if (!sprint) actions.push({ type: "create-sprint" });
  else if (!iterationsMatch(sprint)) {
    actions.push({ type: "update-sprint", field: sprint });
  }

  if (!need("Estimate", "NUMBER")) actions.push({ type: "create-estimate" });

  const options = wantedAreaOptions(labels);
  const area = need("Area", "SINGLE_SELECT");
  if (!area) actions.push({ type: "create-area", options });
  else if (!areaOptionsMatch(area, options)) {
    actions.push({ type: "update-area", field: area, options });
  }
  return actions;
}

// A view that exists is left alone. People tune views by hand, and grouping can
// only be set by hand, so rewriting one on each run would undo that work.
export function planViews(views) {
  const names = new Set(views.map((view) => view.name));
  const actions = [];
  let spareDefault = views.find((view) => view.name === DEFAULT_VIEW);
  for (const view of VIEWS) {
    if (names.has(view.name)) continue;
    if (spareDefault && spareDefault.layout === view.layout) {
      actions.push({ type: "rename", view, viewId: spareDefault.id });
      spareDefault = null;
    } else {
      actions.push({ type: "create", view });
    }
  }
  return actions;
}

export function wantedBoardItems({ backlog, issuesByKey }) {
  const wanted = [];
  const add = (key, area, estimate, plannedSprint, ready) => {
    const issue = issuesByKey.get(key);
    if (!issue) return;
    wanted.push({
      key,
      number: issue.number,
      contentId: issue.id,
      closed: issue.state === "CLOSED",
      milestone: issue.milestone?.title ?? null,
      area: areaOption(area),
      estimate,
      plannedSprint,
      ready,
    });
  };
  for (const epic of backlog.epics)
    add(`Epic ${epic.key}`, epic.area, null, null, false);
  for (const story of backlog.stories) {
    const planned = story.sprints?.[0];
    add(
      story.key,
      story.area,
      story.estimate,
      planned ? sprintTitle(planned) : null,
      Boolean(story.ready),
    );
  }
  return wanted;
}

// Status is the holder's to keep true, so an open item keeps whatever it has,
// with two exceptions. An item with none gets Todo. A story the data calls ready
// never sits at Todo, which means "not yet refined": GitHub puts every new item
// at Todo, so this is also what lifts the starter stories to Ready.
export function wantedStatus(wanted, item) {
  if (wanted.closed) return "Done";
  if (wanted.ready && (item.status === null || item.status === "Todo")) {
    return READY;
  }
  return item.status ?? "Todo";
}

export function planItemAdds(wanted, items) {
  const present = new Set(items.map((item) => item.contentId));
  return wanted.filter((item) => !present.has(item.contentId));
}

// A closed item is Done whatever it says, and its Sprint follows the milestone,
// which records when it really finished.
export function planItemValues(wanted, item) {
  const changes = [];
  if (item.area !== wanted.area) {
    changes.push({ field: "Area", option: wanted.area });
  }
  if (wanted.estimate !== null && item.estimate !== wanted.estimate) {
    changes.push({ field: "Estimate", number: wanted.estimate });
  }
  const status = wantedStatus(wanted, item);
  if (item.status !== status) changes.push({ field: "Status", option: status });
  const sprint = wanted.closed
    ? wanted.milestone
    : (item.sprint ?? wanted.plannedSprint);
  if (sprint && item.sprint !== sprint) {
    changes.push({ field: "Sprint", iteration: sprint });
  }
  return changes;
}
