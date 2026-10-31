// A stand-in for the `gh` command, for tests. It sits behind the real GitHub
// client, so the tests run the same arguments and JSON bodies the scripts send
// for real, and it copies the GitHub behaviour the scripts have to survive:
//
// - a milestone's due time is rewritten, as a date with no time of day;
// - a new project starts with default fields, one "View 1" table and three
//   Status options, and an item added to it gets Status "Todo";
// - project 2 has the board's title and blows up on any contact.

const reply = (data) => ({
  status: 0,
  stdout: JSON.stringify(data),
  stderr: "",
});
const failure = (message) => ({ status: 1, stdout: "", stderr: message });

const OPTION_STATUS = [
  { id: "todo", name: "Todo", color: "GREEN", description: "" },
  { id: "doing", name: "In Progress", color: "YELLOW", description: "" },
  { id: "done", name: "Done", color: "PURPLE", description: "" },
];

const defaultFields = () => [
  { id: "f-title", name: "Title", dataType: "TITLE" },
  { id: "f-assignees", name: "Assignees", dataType: "ASSIGNEES" },
  {
    id: "f-status",
    name: "Status",
    dataType: "SINGLE_SELECT",
    options: structuredClone(OPTION_STATUS),
  },
  { id: "f-labels", name: "Labels", dataType: "LABELS" },
];

function connection(nodes) {
  return { pageInfo: { hasNextPage: false, endCursor: null }, nodes };
}

export class SimulatedGitHub {
  constructor({
    labels = [],
    milestones = [],
    issues = [],
    pulls = [],
    projects = [],
    rulesets = [],
    dueTime = "07:00:00Z",
  } = {}) {
    Object.assign(this, { labels, milestones, issues, pulls, projects });
    this.rulesets = rulesets;
    this.dueTime = dueTime;
    this.writes = [];
    this.nextIssue = 1 + Math.max(0, ...issues.map((item) => item.number));
    this.nextIssue = Math.max(
      this.nextIssue,
      1 + Math.max(0, ...pulls.map((item) => item.number)),
    );
    this.nextProject = 1 + Math.max(2, ...projects.map((item) => item.number));
    this.nextId = 1;
    this.exec = this.exec.bind(this);
  }

  id(prefix) {
    this.nextId += 1;
    return `${prefix}_new${this.nextId}`;
  }

  project(id) {
    const project = this.projects.find((item) => item.id === id);
    if (!project) throw new Error(`No project ${id}`);
    if (project.number === 2) throw new Error("Touched the abandoned project");
    return project;
  }

  exec(args, input) {
    if (args[1] === "graphql") {
      const { query, variables } = JSON.parse(input);
      return this.graphql(query, variables);
    }
    if (args.includes("--method")) {
      const method = args[args.indexOf("--method") + 1];
      const path = args[args.indexOf("--method") + 2];
      this.writes.push(`${method} ${path}`);
      return this.restWrite(method, path, input ? JSON.parse(input) : null);
    }
    return this.restRead(args.at(-1));
  }

  restRead(url) {
    const path = url.split("?")[0];
    if (path.endsWith("/labels")) return reply([this.labels]);
    if (path.endsWith("/milestones")) return reply([this.milestones]);
    if (path.endsWith("/rulesets")) return reply([this.rulesets]);
    const ruleset = path.match(/rulesets\/(\d+)$/);
    if (ruleset) {
      return reply(this.rulesets.find((r) => r.id === Number(ruleset[1])));
    }
    return failure(`HTTP 404: ${url}`);
  }

  restWrite(method, path, body) {
    const label = path.match(/\/labels\/(.+)$/);
    if (label)
      return this.writeLabel(method, decodeURIComponent(label[1]), body);
    if (path.endsWith("/labels")) {
      this.labels.push({ ...body });
      return reply(body);
    }
    if (path.endsWith("/milestones")) {
      const milestone = {
        number: this.milestones.length + 1,
        state: "open",
        ...body,
        due_on: this.normaliseDue(body.due_on),
      };
      this.milestones.push(milestone);
      return reply(milestone);
    }
    const milestone = path.match(/\/milestones\/(\d+)$/);
    if (milestone) {
      const found = this.milestones.find(
        (item) => item.number === Number(milestone[1]),
      );
      Object.assign(found, body);
      if (body.due_on) found.due_on = this.normaliseDue(body.due_on);
      return reply(found);
    }
    if (path.endsWith("/issues")) return this.createIssue(body);
    const issue = path.match(/\/issues\/(\d+)$/);
    if (issue) return this.updateIssue(Number(issue[1]), body);
    return failure(`HTTP 404: ${path}`);
  }

  writeLabel(method, name, body) {
    const index = this.labels.findIndex(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (index === -1) return failure(`HTTP 404: label ${name}`);
    if (method === "DELETE") {
      this.labels.splice(index, 1);
      return { status: 0, stdout: "", stderr: "" };
    }
    const { new_name: newName, ...rest } = body;
    Object.assign(this.labels[index], rest, { name: newName ?? name });
    return reply(this.labels[index]);
  }

  normaliseDue(dueOn) {
    return `${dueOn.slice(0, 10)}T${this.dueTime}`;
  }

  createIssue({ title, body, labels }) {
    const issue = {
      id: this.id("I"),
      number: this.nextIssue,
      title,
      body,
      state: "OPEN",
      stateReason: null,
      closedAt: null,
      milestone: null,
      labels,
      assignees: [],
      parent: null,
    };
    this.nextIssue += 1;
    this.issues.push(issue);
    return reply({ ...issue, node_id: issue.id });
  }

  updateIssue(number, patch) {
    const issue = this.issues.find((item) => item.number === number);
    const target = issue ?? this.pulls.find((item) => item.number === number);
    if (patch.state) throw new Error("A script changed an issue's state");
    const { milestone, ...rest } = patch;
    Object.assign(target, rest);
    if (milestone !== undefined) {
      const found = this.milestones.find((item) => item.number === milestone);
      target.milestone = { number: found.number, title: found.title };
    }
    return reply(target);
  }

  graphql(query, variables) {
    const mutation = query.match(/mutation[^{]*\{\s*(\w+)/)?.[1];
    if (mutation) {
      this.writes.push(`graphql ${mutation}`);
      return reply({ data: this.mutate(mutation, variables.input) });
    }
    return reply({ data: this.read(query, variables) });
  }

  read(query, variables) {
    if (query.includes("issues(first")) {
      const nodes = this.issues.map((issue) => ({
        ...issue,
        labels: { nodes: issue.labels.map((name) => ({ name })) },
        assignees: { nodes: issue.assignees.map((login) => ({ login })) },
        parent: issue.parent ? { number: issue.parent } : null,
      }));
      return { repository: { issues: connection(nodes) } };
    }
    if (query.includes("pullRequests(first")) {
      const nodes = this.pulls.map((pull) => ({
        ...pull,
        closingIssuesReferences: {
          nodes: pull.closes.map((number) => ({ number })),
        },
      }));
      return { repository: { pullRequests: connection(nodes) } };
    }
    if (query.includes("projectsV2(first")) {
      const nodes = this.projects
        .filter((project) => project.linked)
        .map(({ id, number, title, closed, url }) => ({
          id,
          number,
          title,
          closed,
          url,
        }));
      return {
        repository: {
          id: "R_repo",
          owner: { id: "U_owner" },
          projectsV2: { nodes },
        },
      };
    }
    if (query.includes("views(first")) {
      const project = this.project(variables.id);
      return {
        node: {
          number: project.number,
          shortDescription: project.shortDescription,
          fields: { nodes: project.fields },
          views: { nodes: project.views },
        },
      };
    }
    if (query.includes("items(first")) {
      const project = this.project(variables.id);
      return {
        node: {
          number: project.number,
          items: connection(project.items.map((item) => this.itemNode(item))),
        },
      };
    }
    throw new Error(`Unknown query: ${query.slice(0, 80)}`);
  }

  itemNode(item) {
    const value = (name) => (item[name] ? { name: item[name] } : null);
    return {
      id: item.id,
      content: { id: item.contentId, number: item.number },
      status: value("status"),
      area: value("area"),
      estimate: item.estimate === null ? null : { number: item.estimate },
      sprint: item.sprint ? { title: item.sprint } : null,
    };
  }

  mutate(name, input) {
    if (name === "createProjectV2") {
      const project = {
        id: this.id("PVT"),
        number: this.nextProject,
        title: input.title,
        closed: false,
        url: "https://example.test/project",
        linked: Boolean(input.repositoryId),
        shortDescription: "",
        fields: defaultFields(),
        views: [
          {
            id: this.id("V"),
            name: "View 1",
            layout: "TABLE_LAYOUT",
            filter: null,
          },
        ],
        items: [],
      };
      this.nextProject += 1;
      this.projects.push(project);
      return { [name]: { projectV2: project } };
    }
    if (name === "linkProjectV2ToRepository") {
      this.project(input.projectId).linked = true;
      return { [name]: { repository: { id: "R_repo" } } };
    }
    if (name === "updateProjectV2") {
      this.project(input.projectId).shortDescription = input.shortDescription;
      return { [name]: { projectV2: { id: input.projectId } } };
    }
    if (name === "createProjectV2Field") return this.createField(input);
    if (name === "updateProjectV2Field") return this.updateField(input);
    if (name === "createProjectV2View") {
      const view = {
        id: this.id("V"),
        name: input.name,
        layout: input.layout,
        filter: null,
      };
      this.project(input.projectId).views.push(view);
      return { [name]: { projectV2View: view } };
    }
    if (name === "updateProjectV2View") {
      const view = this.projects
        .flatMap((project) => project.views)
        .find((item) => item.id === input.viewId);
      Object.assign(view, {
        name: input.name ?? view.name,
        filter: input.filter,
      });
      return { [name]: { projectV2View: view } };
    }
    if (name === "addProjectV2ItemById") return this.addItem(input);
    if (name === "updateProjectV2ItemFieldValue") return this.setValue(input);
    if (name === "addSubIssue") {
      const child = this.issues.find((item) => item.id === input.subIssueId);
      const parent = this.issues.find((item) => item.id === input.issueId);
      if (child.parent && !input.replaceParent) {
        throw new Error("Sub-issue already has a parent");
      }
      child.parent = parent.number;
      return { [name]: { issue: parent, subIssue: child } };
    }
    throw new Error(`Unknown mutation: ${name}`);
  }

  createField(input) {
    const project = this.project(input.projectId);
    const field = {
      id: this.id("F"),
      name: input.name,
      dataType: input.dataType,
    };
    if (input.dataType === "SINGLE_SELECT") {
      field.options = input.singleSelectOptions.map((option) => ({
        id: this.id("O"),
        ...option,
      }));
    }
    if (input.dataType === "ITERATION") {
      field.configuration = {
        iterations: input.iterationConfiguration.iterations.map((item) => ({
          id: this.id("IT"),
          ...item,
        })),
        completedIterations: [],
      };
    }
    project.fields.push(field);
    return { createProjectV2Field: { projectV2Field: field } };
  }

  updateField(input) {
    const field = this.projects
      .flatMap((project) => project.fields)
      .find((item) => item.id === input.fieldId);
    if (input.singleSelectOptions) {
      field.options = input.singleSelectOptions.map((option) => ({
        id: option.id ?? this.id("O"),
        ...option,
      }));
    }
    if (input.iterationConfiguration) {
      field.configuration = {
        iterations: input.iterationConfiguration.iterations.map((item) => ({
          id: item.id ?? this.id("IT"),
          ...item,
        })),
        completedIterations: [],
      };
    }
    return { updateProjectV2Field: { projectV2Field: field } };
  }

  addItem({ projectId, contentId }) {
    const project = this.project(projectId);
    const issue = this.issues.find((item) => item.id === contentId);
    const existing = project.items.find((item) => item.contentId === contentId);
    const item = existing ?? {
      id: this.id("ITEM"),
      contentId,
      number: issue.number,
      status: "Todo",
      area: null,
      estimate: null,
      sprint: null,
    };
    if (!existing) project.items.push(item);
    return { addProjectV2ItemById: { item } };
  }

  setValue({ projectId, itemId, fieldId, value }) {
    const project = this.project(projectId);
    const item = project.items.find((entry) => entry.id === itemId);
    const field = project.fields.find((entry) => entry.id === fieldId);
    if (value.singleSelectOptionId) {
      const option = field.options.find(
        (entry) => entry.id === value.singleSelectOptionId,
      );
      item[field.name.toLowerCase()] = option.name;
    } else if (value.number !== undefined) {
      item.estimate = value.number;
    } else {
      const { iterations, completedIterations } = field.configuration;
      const iteration = [...iterations, ...completedIterations].find(
        (entry) => entry.id === value.iterationId,
      );
      item.sprint = iteration.title;
    }
    return { updateProjectV2ItemFieldValue: { projectV2Item: item } };
  }
}

const handMade = (number, title) => ({
  id: `I-${number}`,
  number,
  title,
  body: "Written by hand.",
  state: "OPEN",
  stateReason: null,
  closedAt: null,
  milestone: null,
  labels: [],
  assignees: [],
  parent: null,
});

// Today's live repository, as read on 2026-10-31: GitHub's default labels, no
// milestones, the hand-made issues #1, #2 and #4 to #7, P-1's merged pull
// request, and the abandoned project, renamed and closed, that must stay
// untouched.
export function liveRepository(overrides = {}) {
  return new SimulatedGitHub({
    labels: [
      { name: "bug", color: "d73a4a", description: "Something isn't working" },
      { name: "enhancement", color: "a2eeef", description: "New feature" },
    ],
    issues: [
      {
        id: "I-1",
        number: 1,
        title: "P-1: Ground rules",
        body: "Written by hand.",
        state: "CLOSED",
        stateReason: "COMPLETED",
        closedAt: "2026-10-31T07:52:44Z",
        milestone: null,
        labels: [],
        assignees: [],
        parent: null,
      },
      {
        id: "I-2",
        number: 2,
        title: "P-2: GitHub as code",
        body: "Written by hand.",
        state: "OPEN",
        stateReason: null,
        closedAt: null,
        milestone: null,
        labels: [],
        assignees: [],
        parent: null,
      },
      handMade(4, "P-3: The problem, the research and the questions"),
      handMade(5, "P-4: The four areas"),
      handMade(6, "P-5: Monorepo and tooling"),
      handMade(7, "P-6: CI and the security baseline"),
    ],
    pulls: [
      {
        number: 3,
        title: "docs: add the ground rules (P-1)",
        state: "MERGED",
        mergedAt: "2026-10-31T07:52:43Z",
        milestone: null,
        closes: [1],
      },
    ],
    projects: [
      {
        id: "PVT-abandoned",
        number: 2,
        title: "OrderPilot delivery (port attempt)",
        closed: true,
        linked: false,
        url: "https://example.test/abandoned",
        shortDescription: "",
        fields: [],
        views: [],
        items: [],
      },
    ],
    ...overrides,
  });
}
