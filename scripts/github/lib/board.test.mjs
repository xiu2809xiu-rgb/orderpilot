import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ABANDONED_PROJECT_NUMBER,
  BOARD_TITLE,
  iterationConfiguration,
  iterationsMatch,
  pickBoard,
  planFields,
  planItemAdds,
  planItemValues,
  planViews,
  readBoardItems,
  readBoardShape,
  wantedAreaOptions,
  wantedBoardItems,
  wantedIterations,
} from "./board.mjs";
import { loadBacklog, loadLabels } from "./catalogue.mjs";

const labels = loadLabels();

const project = (number, overrides = {}) => ({
  id: `PVT-${number}`,
  number,
  title: BOARD_TITLE,
  closed: false,
  ...overrides,
});

const sprintField = (iterations, completedIterations = []) => ({
  id: "F-sprint",
  name: "Sprint",
  dataType: "ITERATION",
  configuration: { iterations, completedIterations },
});

const withIds = (iterations) =>
  iterations.map((item, index) => ({ id: `it-${index}`, ...item }));

const allFields = () => [
  { id: "F-status", name: "Status", dataType: "SINGLE_SELECT", options: [] },
  sprintField(withIds(wantedIterations())),
  { id: "F-estimate", name: "Estimate", dataType: "NUMBER" },
  {
    id: "F-area",
    name: "Area",
    dataType: "SINGLE_SELECT",
    options: wantedAreaOptions(labels).map((option, index) => ({
      id: `o-${index}`,
      ...option,
    })),
  },
];

test("the abandoned project is the number the brief warns about", () => {
  assert.equal(ABANDONED_PROJECT_NUMBER, 2);
});

test("the board linked to the repository is found by title", () => {
  const board = pickBoard([project(7), project(9, { title: "Other" })]);
  assert.equal(board.number, 7);
});

test("the abandoned project is never picked, even if linked here by mistake", () => {
  assert.equal(pickBoard([project(2)]), null);
  assert.equal(pickBoard([project(2), project(7)]).number, 7);
});

test("a closed project is not the board", () => {
  assert.equal(pickBoard([project(7, { closed: true })]), null);
});

test("no linked board means none, and two is an error", () => {
  assert.equal(pickBoard([]), null);
  assert.throws(() => pickBoard([project(7), project(8)]), /#7, #8/);
});

test("reading the abandoned project's shape or items is refused", async () => {
  const github = {
    query: async () => assert.fail("reached GitHub"),
  };
  const abandoned = project(2);
  await assert.rejects(() => readBoardShape(github, abandoned), /untouched/);
  await assert.rejects(() => readBoardItems(github, abandoned), /untouched/);
});

test("a board that turns out to be project 2 is refused on read", async () => {
  const github = {
    query: async () => ({
      node: { number: 2, fields: { nodes: [] }, views: { nodes: [] } },
    }),
  };
  await assert.rejects(() => readBoardShape(github, project(7)), /untouched/);
});

test("a new board needs Sprint, Estimate and Area", () => {
  const types = planFields([], labels).map((action) => action.type);
  assert.deepEqual(types, ["create-sprint", "create-estimate", "create-area"]);
});

test("a complete board needs no field changes", () => {
  assert.deepEqual(planFields(allFields(), labels), []);
});

test("the iteration field has all 18 sprints, a week each", () => {
  const { startDate, duration, iterations } = iterationConfiguration();
  assert.equal(startDate, "2026-10-26");
  assert.equal(duration, 7);
  assert.equal(iterations.length, 18);
  assert.deepEqual(iterations[0], {
    title: "Sprint 01 (W2)",
    startDate: "2026-10-26",
    duration: 7,
  });
  assert.equal(iterations[17].title, "Sprint 18 (W19)");
});

test("a finished sprint moving to completed is not a change", () => {
  const all = withIds(wantedIterations());
  const field = sprintField(all.slice(2), all.slice(0, 2).reverse());
  assert.ok(iterationsMatch(field));
});

test("a missing or retitled iteration is a change", () => {
  const all = withIds(wantedIterations());
  assert.equal(iterationsMatch(sprintField(all.slice(1))), false);
  const renamed = all.map((item, index) =>
    index === 3 ? { ...item, title: "Renamed" } : item,
  );
  assert.equal(iterationsMatch(sprintField(renamed)), false);
});

test("updating iterations keeps the ids of the ones that exist", () => {
  const all = withIds(wantedIterations());
  const { iterations } = iterationConfiguration(all.slice(0, 2));
  assert.equal(iterations[0].id, "it-0");
  assert.equal(iterations[1].id, "it-1");
  assert.equal("id" in iterations[2], false);
});

test("Area options keep the comma in the name", () => {
  const names = wantedAreaOptions(labels).map((option) => option.name);
  assert.deepEqual(names, [
    "1 document AI and integration",
    "2 order workflows and approvals",
    "3 checks, tracker and insights",
    "4 controls and monitoring",
    "team",
  ]);
});

test("a changed Area option is planned as an update", () => {
  const fields = allFields();
  fields[3].options[2].name = "3 checks";
  assert.deepEqual(
    planFields(fields, labels).map((action) => action.type),
    ["update-area"],
  );
});

test("a field of the wrong type stops the script", () => {
  const fields = [{ id: "F", name: "Estimate", dataType: "TEXT" }];
  assert.throws(() => planFields(fields, labels), /Fix it by hand/);
});

test("the default view becomes Backlog, and Sprint is created", () => {
  const actions = planViews([
    { id: "V1", name: "View 1", layout: "TABLE_LAYOUT", filter: null },
  ]);
  assert.deepEqual(
    actions.map((action) => [action.type, action.view.name]),
    [
      ["rename", "Backlog"],
      ["create", "Sprint"],
    ],
  );
});

test("existing views are left alone, even after someone changes them", () => {
  const actions = planViews([
    { id: "V1", name: "Backlog", layout: "TABLE_LAYOUT", filter: "other" },
    { id: "V2", name: "Sprint", layout: "BOARD_LAYOUT", filter: null },
    { id: "V3", name: "View 1", layout: "TABLE_LAYOUT", filter: null },
  ]);
  assert.deepEqual(actions, []);
});

test("the Sprint view is a board of the current iteration", () => {
  const [, sprint] = planViews([
    { id: "V1", name: "View 1", layout: "TABLE_LAYOUT", filter: null },
  ]);
  assert.equal(sprint.view.layout, "BOARD_LAYOUT");
  assert.equal(sprint.view.filter, "sprint:@current");
});

const wanted = (overrides = {}) => ({
  key: "P-3",
  number: 5,
  contentId: "I-5",
  closed: false,
  milestone: null,
  area: "team",
  estimate: 8,
  plannedSprint: null,
  ...overrides,
});

const item = (overrides = {}) => ({
  id: "ITEM",
  contentId: "I-5",
  number: 5,
  status: "Todo",
  area: "team",
  estimate: 8,
  sprint: null,
  ...overrides,
});

test("only issues missing from the board are added", () => {
  const list = [wanted(), wanted({ contentId: "I-6", number: 6 })];
  const adds = planItemAdds(list, [item()]);
  assert.deepEqual(
    adds.map((entry) => entry.number),
    [6],
  );
});

test("an item that matches the data changes nothing", () => {
  assert.deepEqual(planItemValues(wanted(), item()), []);
});

test("a new item gets its area, estimate and planned sprint", () => {
  const changes = planItemValues(
    wanted({ plannedSprint: "Sprint 02 (W3)" }),
    item({ area: null, estimate: null }),
  );
  assert.deepEqual(changes, [
    { field: "Area", option: "team" },
    { field: "Estimate", number: 8 },
    { field: "Sprint", iteration: "Sprint 02 (W3)" },
  ]);
});

test("a person's Status and Sprint on an open item are kept", () => {
  const changes = planItemValues(
    wanted({ plannedSprint: "Sprint 02 (W3)" }),
    item({ status: "In Progress", sprint: "Sprint 03 (W4)" }),
  );
  assert.deepEqual(changes, []);
});

test("an open item with no Status gets Todo", () => {
  assert.deepEqual(planItemValues(wanted(), item({ status: null })), [
    { field: "Status", option: "Todo" },
  ]);
});

test("a closed item is Done, in the sprint of its milestone", () => {
  const changes = planItemValues(
    wanted({ closed: true, milestone: "Sprint 01 (W2)" }),
    item({ status: "Todo", sprint: "Sprint 05 (W6)" }),
  );
  assert.deepEqual(changes, [
    { field: "Status", option: "Done" },
    { field: "Sprint", iteration: "Sprint 01 (W2)" },
  ]);
});

test("an epic has no estimate to set", () => {
  const changes = planItemValues(
    wanted({ estimate: null }),
    item({ estimate: null }),
  );
  assert.deepEqual(changes, []);
});

test("every epic and story that has an issue is wanted on the board", () => {
  const backlog = loadBacklog();
  const issuesByKey = new Map([
    ["Epic T", { id: "I-9", number: 9, state: "OPEN", milestone: null }],
    [
      "P-1",
      {
        id: "I-1",
        number: 1,
        state: "CLOSED",
        milestone: { title: "Sprint 01 (W2)" },
      },
    ],
    ["T-6", { id: "I-8", number: 8, state: "OPEN", milestone: null }],
  ]);
  const list = wantedBoardItems({ backlog, issuesByKey });
  assert.deepEqual(
    list.map((entry) => entry.key),
    ["Epic T", "P-1", "T-6"],
  );
  assert.equal(list[0].estimate, null);
  assert.equal(list[0].area, "team");
  assert.equal(list[1].closed, true);
  assert.equal(list[1].milestone, "Sprint 01 (W2)");
  assert.equal(list[2].plannedSprint, "Sprint 02 (W3)");
});
