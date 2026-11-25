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
  /** True for a caller who may open any role's inbox: the picker is an extra choice. */
  mayPick: boolean;
  /** True when the inbox shown is another role's, read through the inbox route and not "my tasks". */
  other: boolean;
  setRole: (role: InboxRole) => void;
}

/**
 * Whose inbox the page shows. A role with an inbox opens its own first. A role
 * that also oversees (it holds `workflows.inboxes.any`) may pick another one,
 * kept in the URL so a link opens the same inbox. A role that oversees and has
 * no inbox starts on Support's. The server checks both; this only chooses the route.
 */
export function useInboxRole(): InboxChoice {
  const session = useSessionStore((state) => state.session);
  const [params, setParams] = useSearchParams();
  const mayPick = hasPermission(session, "workflows.inboxes.any");
  const own = INBOX_ROLES.find((role) => role === session?.user.role);
  const asked = inboxRoleSchema.safeParse(params.get("role"));
  const role = mayPick
    ? asked.success
      ? asked.data
      : (own ?? "SUPPORT")
    : own;
  return {
    role,
    mayPick,
    other: role !== undefined && role !== own,
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
