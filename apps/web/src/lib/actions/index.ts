// Import from "@/lib/actions": this also registers the built-in actions.
import "./builtin";

export {
  actionsFor,
  actionsForRole,
  listActions,
  registerAction,
  type ActionContext,
  type AppAction,
} from "./registry";
