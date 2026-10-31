// Creates the board OrderPilot delivery, linked to this repository, and keeps
// its fields, views and items in step with the backlog.
// Usage: node scripts/github/sync-board.mjs [--dry-run]
//
// It finds the board only through this repository's links. See lib/board.mjs
// for why it must never look among the owner's projects by title.

import {
  BOARD_DESCRIPTION,
  BOARD_TITLE,
  VIEWS,
  closedBoard,
  configuredIterations,
  iterationConfiguration,
  pickBoard,
  planFields,
  planItemAdds,
  planItemValues,
  planViews,
  readBoardItems,
  readBoardShape,
  readRepository,
  wantedBoardItems,
} from "./lib/board.mjs";
import { loadBacklog, loadLabels } from "./lib/catalogue.mjs";
import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { readIssues } from "./lib/issues.mjs";
import { matchIssues } from "./seed-backlog.mjs";

// GitHub's own project workflows set Status a moment after an item is added.
// Reading the items back too soon would plan against a value about to change.
const SETTLE_MS = 8000;

const CREATE_PROJECT = `mutation($input: CreateProjectV2Input!) {
  createProjectV2(input: $input) { projectV2 { id number title url } }
}`;
const LINK_PROJECT = `mutation($input: LinkProjectV2ToRepositoryInput!) {
  linkProjectV2ToRepository(input: $input) { repository { id } }
}`;
const UPDATE_PROJECT = `mutation($input: UpdateProjectV2Input!) {
  updateProjectV2(input: $input) { projectV2 { id } }
}`;
const CREATE_FIELD = `mutation($input: CreateProjectV2FieldInput!) {
  createProjectV2Field(input: $input) { projectV2Field { __typename } }
}`;
const UPDATE_FIELD = `mutation($input: UpdateProjectV2FieldInput!) {
  updateProjectV2Field(input: $input) { projectV2Field { __typename } }
}`;
const CREATE_VIEW = `mutation($input: CreateProjectV2ViewInput!) {
  createProjectV2View(input: $input) { projectV2View { id } }
}`;
const UPDATE_VIEW = `mutation($input: UpdateProjectV2ViewInput!) {
  updateProjectV2View(input: $input) { projectV2View { id } }
}`;
const ADD_ITEM = `mutation($input: AddProjectV2ItemByIdInput!) {
  addProjectV2ItemById(input: $input) { item { id } }
}`;
const SET_VALUE = `mutation($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) { projectV2Item { id } }
}`;

async function ensureBoard(github, repository) {
  const existing = pickBoard(repository.projects);
  if (existing) return { board: existing, created: false };
  const closed = closedBoard(repository.projects);
  if (closed) {
    throw new Error(
      `"${BOARD_TITLE}" (#${closed.number}) is closed. Reopen it rather than make a second board.`,
    );
  }
  const data = await github.mutate(
    `create the project "${BOARD_TITLE}", linked to ${github.repo}`,
    CREATE_PROJECT,
    {
      input: {
        ownerId: repository.ownerId,
        title: BOARD_TITLE,
        repositoryId: repository.id,
      },
    },
  );
  return { board: data?.createProjectV2.projectV2 ?? null, created: true };
}

// Without this link the next run could not find the board, and would make
// another one. A board made this run was linked as it was made, and GitHub can
// take a moment to list a new link, so only an older board is checked.
async function ensureLinked(github, board) {
  const { projects, id } = await readRepository(github);
  if (pickBoard(projects)?.id === board.id) return;
  await github.mutate(
    `link project #${board.number} to ${github.repo}`,
    LINK_PROJECT,
    { input: { projectId: board.id, repositoryId: id } },
  );
}

async function applyFieldAction(github, board, action) {
  const projectId = board.id;
  const { type, field, options } = action;
  if (type === "create-sprint") {
    await github.mutate("create the Sprint iteration field", CREATE_FIELD, {
      input: {
        projectId,
        dataType: "ITERATION",
        name: "Sprint",
        iterationConfiguration: iterationConfiguration(),
      },
    });
  } else if (type === "update-sprint") {
    await github.mutate("update the Sprint iterations", UPDATE_FIELD, {
      input: {
        fieldId: field.id,
        iterationConfiguration: iterationConfiguration(
          configuredIterations(field),
        ),
      },
    });
  } else if (type === "update-status") {
    await github.mutate("add the Ready option to Status", UPDATE_FIELD, {
      input: { fieldId: field.id, singleSelectOptions: options },
    });
  } else if (type === "create-estimate") {
    await github.mutate("create the Estimate field", CREATE_FIELD, {
      input: { projectId, dataType: "NUMBER", name: "Estimate" },
    });
  } else if (type === "create-area") {
    await github.mutate("create the Area field", CREATE_FIELD, {
      input: {
        projectId,
        dataType: "SINGLE_SELECT",
        name: "Area",
        singleSelectOptions: options,
      },
    });
  } else {
    const ids = new Map(field.options.map((item) => [item.name, item.id]));
    await github.mutate("update the Area options", UPDATE_FIELD, {
      input: {
        fieldId: field.id,
        singleSelectOptions: options.map((option) =>
          ids.has(option.name)
            ? { id: ids.get(option.name), ...option }
            : option,
        ),
      },
    });
  }
}

function fieldIdsFor(view, fields) {
  return view.fields.flatMap((name) => {
    const field = fields.find((item) => item.name === name);
    return field ? [field.id] : [];
  });
}

async function applyViewAction(github, board, action, fields) {
  const { type, view, viewId } = action;
  let id = viewId;
  if (type === "create") {
    const data = await github.mutate(
      `create the ${view.name} view`,
      CREATE_VIEW,
      {
        input: { projectId: board.id, name: view.name, layout: view.layout },
      },
    );
    id = data?.createProjectV2View.projectV2View.id;
  }
  const verb = type === "rename" ? "rename the default view to" : "set up";
  await github.mutate(`${verb} ${view.name}`, UPDATE_VIEW, {
    input: {
      viewId: id,
      name: view.name,
      filter: view.filter,
      configuration: { visibleFieldIds: fieldIdsFor(view, fields) },
    },
  });
}

async function setValue(github, board, item, fieldId, value, summary) {
  await github.mutate(summary, SET_VALUE, {
    input: { projectId: board.id, itemId: item.id, fieldId, value },
  });
}

function fieldLookups(fields) {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const optionId = (fieldName, optionName) => {
    const option = byName
      .get(fieldName)
      .options.find((item) => item.name === optionName);
    if (!option) {
      throw new Error(
        `The board's ${fieldName} has no option "${optionName}".`,
      );
    }
    return option.id;
  };
  const iterationId = (title) =>
    configuredIterations(byName.get("Sprint")).find(
      (iteration) => iteration.title === title,
    )?.id;
  return { byName, optionId, iterationId };
}

async function applyChange(github, board, item, wanted, change, lookups) {
  const { byName, optionId, iterationId } = lookups;
  const fieldId = byName.get(change.field).id;
  const summary = `set ${change.field} on #${wanted.number} (${wanted.key})`;
  if (change.option !== undefined) {
    const value = {
      singleSelectOptionId: optionId(change.field, change.option),
    };
    await setValue(github, board, item, fieldId, value, summary);
  } else if (change.number !== undefined) {
    await setValue(
      github,
      board,
      item,
      fieldId,
      { number: change.number },
      summary,
    );
  } else {
    const id = iterationId(change.iteration);
    if (id) {
      await setValue(
        github,
        board,
        item,
        fieldId,
        { iterationId: id },
        summary,
      );
    }
  }
}

function describePlan(wanted) {
  return [
    `would give the board the fields Status (with Ready), Sprint (18 iterations), Estimate and Area`,
    `would give the board the views ${VIEWS.map((view) => view.name).join(" and ")}`,
    `would add every backlog issue: the ${wanted.length} that exist now, and those the seed creates`,
    `would put the ready starter stories at Ready, and closed work at Done in the sprint it finished`,
  ];
}

async function syncItems(github, board, wanted) {
  const adds = planItemAdds(wanted, await readBoardItems(github, board));
  for (const item of adds) {
    await github.mutate(`add #${item.number} (${item.key})`, ADD_ITEM, {
      input: { projectId: board.id, contentId: item.contentId },
    });
  }
  if (adds.length > 0 && !github.dryRun) await github.sleep(SETTLE_MS);

  const shape = await readBoardShape(github, board);
  const lookups = fieldLookups(shape.fields);
  const items = await readBoardItems(github, board);
  let changes = 0;
  for (const want of wanted) {
    const item = items.find((entry) => entry.contentId === want.contentId);
    if (!item) continue;
    for (const change of planItemValues(want, item)) {
      await applyChange(github, board, item, want, change, lookups);
      changes += 1;
    }
  }
  return { adds: adds.length, changes };
}

export async function syncBoard(github) {
  const backlog = loadBacklog();
  const labels = loadLabels();
  const repository = await readRepository(github);
  const issues = await readIssues(github);
  const { byKey } = matchIssues(issues);
  const wanted = wantedBoardItems({ backlog, issuesByKey: byKey });

  const { board, created } = await ensureBoard(github, repository);
  if (!board) {
    for (const line of describePlan(wanted)) github.log(line);
    github.log("board: does not exist yet");
    return { created: true };
  }
  if (!created) await ensureLinked(github, board);

  let shape = await readBoardShape(github, board);
  if (shape.shortDescription !== BOARD_DESCRIPTION) {
    await github.mutate("set the board's description", UPDATE_PROJECT, {
      input: { projectId: board.id, shortDescription: BOARD_DESCRIPTION },
    });
  }
  const fieldActions = planFields(shape.fields, labels);
  for (const action of fieldActions) {
    await applyFieldAction(github, board, action);
  }
  if (fieldActions.length > 0) shape = await readBoardShape(github, board);

  const viewActions = planViews(shape.views);
  for (const action of viewActions) {
    await applyViewAction(github, board, action, shape.fields);
  }

  // A dry run stops here when fields are missing: the item plan needs their ids.
  if (github.dryRun && fieldActions.length > 0) {
    github.log(`would add the ${wanted.length} backlog issue(s) to the board`);
    return { fieldActions, viewActions };
  }
  const { adds, changes } = await syncItems(github, board, wanted);
  github.log(
    `board #${board.number}: ${fieldActions.length} field change(s), ${viewActions.length} view change(s), ${adds} item(s) added, ${changes} value(s) set`,
  );
  return { fieldActions, viewActions, adds, changes };
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli();
    await syncBoard(new GitHub({ dryRun: values["dry-run"] }));
  });
}
