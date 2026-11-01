import {
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
  type Role,
  type Session,
} from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";
import { hasPermission } from "@/stores/session";

/** What an action may use when it runs. */
export interface ActionContext {
  navigate: (to: string) => void;
}

/**
 * Something a person can do from Ctrl+K, and the thing a role's quick actions
 * are made of. A feature declares one with `registerAction`.
 */
export interface AppAction {
  /** Unique and stable, such as "orders.new". Registering it again replaces it. */
  id: string;
  /** The label's text key, looked up in `namespace`. Plain words work too. */
  label: string;
  /** The i18n namespace of `label`. Defaults to "common". */
  namespace?: string;
  icon: LucideIcon;
  /** Other words that should find it, such as "upload" for "New order". */
  keywords?: readonly string[];
  /** Without it the action is for every signed-in person. */
  permission?: Permission;
  run: (context: ActionContext) => void | Promise<void>;
}

const actions = new Map<string, AppAction>();

/**
 * Adds an action to the palette. One call in the feature's `index.ts` is all
 * a story needs. Returns a function that removes it again.
 */
export function registerAction(action: AppAction): () => void {
  actions.set(action.id, action);
  return () => {
    if (actions.get(action.id) === action) actions.delete(action.id);
  };
}

export function listActions(): AppAction[] {
  return [...actions.values()];
}

/** The actions this session may run. The server still decides on every call. */
export function actionsFor(session: Session | null): AppAction[] {
  return listActions().filter((action) =>
    hasPermission(session, action.permission),
  );
}

/**
 * The actions a role holds by default, for its quick actions on the home
 * page. A role whose matrix was edited may differ; the server decides.
 */
export function actionsForRole(role: Role): AppAction[] {
  const held = DEFAULT_ROLE_PERMISSIONS[role];
  return listActions().filter(
    (action) =>
      action.permission === undefined || held.includes(action.permission),
  );
}
