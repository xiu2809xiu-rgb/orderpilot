import type { Session } from "@orderpilot/shared";
import { create } from "zustand";

/**
 * booting: asking the API who we are. anonymous: nobody signed in.
 * active: signed in. expired: the session ended while a page was open, so the
 * page stays and a sign-in dialog sits over it.
 */
export type SessionStatus = "booting" | "anonymous" | "active" | "expired";

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  setSession: (session: Session) => void;
  setAnonymous: () => void;
  setExpired: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: "booting",
  session: null,
  setSession: (session) => {
    set({ status: "active", session });
  },
  setAnonymous: () => {
    set({ status: "anonymous", session: null });
  },
  setExpired: () => {
    set((state) => ({
      // Before a session was open there is nothing to keep on screen.
      status: state.status === "active" ? "expired" : "anonymous",
      session: state.status === "active" ? state.session : null,
    }));
  },
}));

export function hasPermission(
  session: Session | null,
  permission: string | undefined,
): boolean {
  if (permission === undefined) return session !== null;
  return session?.permissions.some((p) => p === permission) ?? false;
}
