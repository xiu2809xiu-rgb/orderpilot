/** The words of the page, as the caller's `t` gives them. */
export type Translate = (
  key: string,
  options?: { defaultValue?: string },
) => string;

export interface AccessGroup {
  id: string;
  title: string;
  sentence: string;
}

interface GroupDef {
  id: string;
  /** "verbs" read "View, create and edit draft orders"; "phrases" stand alone. */
  style: "verbs" | "phrases";
  /** In the order they are read out, not the order the matrix lists them. */
  permissions: readonly string[];
}

/**
 * How the permissions the session holds are told to a person. The matrix
 * itself is area 4's and is never copied here: a permission is read from the
 * session, and only its wording lives in the locale file.
 */
const GROUPS: readonly GroupDef[] = [
  {
    id: "orders",
    style: "verbs",
    permissions: ["orders.read", "orders.create", "orders.edit"],
  },
  {
    id: "documents",
    style: "verbs",
    permissions: ["documents.read", "documents.upload"],
  },
  {
    id: "tracking",
    style: "phrases",
    permissions: [
      "tracker.read",
      "exceptions.read",
      "workflows.read",
      "spr.read",
      "insights.read",
    ],
  },
  {
    id: "tasks",
    style: "phrases",
    permissions: [
      "tasks.complete",
      "approvals.decide",
      "workflows.inboxes.any",
    ],
  },
  {
    id: "payments",
    style: "phrases",
    permissions: ["payments.confirm", "payments.post"],
  },
  { id: "sensitive", style: "phrases", permissions: ["masking.customerNote"] },
  { id: "people", style: "verbs", permissions: ["users.read", "users.manage"] },
  { id: "roles", style: "verbs", permissions: ["roles.read", "roles.manage"] },
  {
    id: "system",
    style: "phrases",
    permissions: ["settings.manage", "aiUsage.read", "audit.read"],
  },
];

// "A, B and C": the British form, as the rest of the app is written.
const LIST = new Intl.ListFormat("en-GB", {
  style: "long",
  type: "conjunction",
});

function sentence(parts: readonly string[]): string {
  const joined = LIST.format(parts);
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * One line for each kind of thing the role can do, built from what the
 * session holds. A permission this page has no wording for is kept, under
 * "Other", with its governance label, so that a new permission never vanishes.
 */
export function describeAccess(
  permissions: readonly string[],
  t: Translate,
): AccessGroup[] {
  const held = new Set(permissions);
  const known = new Set(GROUPS.flatMap((group) => group.permissions));
  const result: AccessGroup[] = [];

  for (const group of GROUPS) {
    const parts = group.permissions
      .filter((permission) => held.has(permission))
      // One permission can hold two things to list ("add|disable").
      .flatMap((permission) =>
        t(`account.access.parts.${permission}`).split("|"),
      );
    if (parts.length === 0) continue;
    const noun =
      group.style === "verbs"
        ? ` ${t(`account.access.groups.${group.id}.noun`)}`
        : "";
    result.push({
      id: group.id,
      title: t(`account.access.groups.${group.id}.title`),
      sentence: `${sentence(parts)}${noun}`,
    });
  }

  const others = permissions
    .filter((permission) => !known.has(permission))
    .map((permission) =>
      t(`governance:permissions.${permission}`, { defaultValue: permission }),
    );
  if (others.length > 0) {
    result.push({
      id: "other",
      title: t("account.access.groups.other.title"),
      sentence: sentence(others),
    });
  }
  return result;
}
