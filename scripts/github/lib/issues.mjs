const ISSUES = `query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, after: $cursor, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id number title body state stateReason closedAt
        milestone { number title }
        labels(first: 50) { nodes { name } }
        assignees(first: 10) { nodes { login } }
        parent { number }
      }
    }
  }
}`;

const PULL_REQUESTS = `query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $cursor, states: [OPEN, MERGED], orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title state mergedAt
        milestone { number title }
        closingIssuesReferences(first: 20) { nodes { number } }
      }
    }
  }
}`;

async function readAll(github, document, connection) {
  const nodes = [];
  let cursor = null;
  do {
    const data = await github.query(document, {
      owner: github.owner,
      name: github.name,
      cursor,
    });
    const page = data.repository[connection];
    nodes.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return nodes;
}

// GraphQL and not REST: the REST list mixes pull requests in with issues, and a
// pull request titled like a story must never be adopted as one.
export async function readIssues(github) {
  const issues = await readAll(github, ISSUES, "issues");
  return issues.map((issue) => ({
    ...issue,
    labels: issue.labels.nodes.map((label) => label.name),
    assignees: issue.assignees.nodes.map((person) => person.login),
    parent: issue.parent?.number ?? null,
  }));
}

export async function readPullRequests(github) {
  const pulls = await readAll(github, PULL_REQUESTS, "pullRequests");
  return pulls.map((pull) => ({
    ...pull,
    closes: pull.closingIssuesReferences.nodes.map((issue) => issue.number),
  }));
}

export async function readMilestones(github) {
  return github.getAll(`repos/${github.repo}/milestones?state=all`);
}
