import {
  INBOX_ROLES,
  inboxRoleSchema,
  type InboxRole,
} from "@orderpilot/shared";
import { useSearchParams } from "react-router";
import { hasPermission, useSessionStore } from "@/stores/session";

export interface InboxChoice {
  /** The role whose inbox is shown. */
  role: InboxRole | undefined;
  /** True for a caller who may open any role's inbox; false for one with their own. */
  mayPick: boolean;
  setRole: (role: InboxRole) => void;
}

/**
 * Whose inbox the page shows. A role with an inbox sees its own. A role that
 * oversees (it holds `workflows.inboxes.any`) picks one, kept in the URL so a
 * link opens the same inbox. The server checks both; this only chooses the route.
 */
export function useInboxRole(): InboxChoice {
  const session = useSessionStore((state) => state.session);
  const [params, setParams] = useSearchParams();
  const mayPick = hasPermission(session, "workflows.inboxes.any");
  const own = INBOX_ROLES.find((role) => role === session?.user.role);
  const asked = inboxRoleSchema.safeParse(params.get("role"));
  return {
    role: mayPick ? (asked.success ? asked.data : "SUPPORT") : own,
    mayPick,
    setRole: (role) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("role", role);
          return next;
        },
        { replace: true },
      );
    },
  };
}
