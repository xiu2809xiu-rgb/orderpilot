import {
  authRoutes,
  type AuthOptions,
  type LoginRequest,
  type Role,
  type Session,
} from "@orderpilot/shared";
import { removeDraftsOf } from "@/lib/draft-keys";
import { queryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { adoptSession } from "./adopt-session";
import { apiClient } from "./instance";

export async function fetchAuthOptions(): Promise<AuthOptions> {
  return (await apiClient.call(authRoutes.options)).data;
}

function begin(session: Session): Session {
  apiClient.markSessionStarted();
  // The guard for a different person is in adoptSession, which a silent
  // refresh goes through as well.
  adoptSession(session);
  return session;
}

export async function demoLogin(role: Role): Promise<Session> {
  return begin((await apiClient.call(authRoutes.demoLogin, { role })).data);
}

export async function login(body: LoginRequest): Promise<Session> {
  return begin((await apiClient.call(authRoutes.login, body)).data);
}

export async function logout(): Promise<void> {
  try {
    await apiClient.call(authRoutes.logout);
  } finally {
    // An explicit sign-out: the person is done, so their drafts go too. An
    // expired session never comes through here, and its drafts stay.
    const viewerId = useSessionStore.getState().session?.user.id;
    if (viewerId !== undefined) removeDraftsOf(viewerId);
    apiClient.markSessionEnded();
    useSessionStore.getState().setAnonymous();
    // The server masks by role, but an answer the browser already keeps is
    // drawn again without asking. So every kept answer goes with the session:
    // the next person to sign in at this tab starts with none. Requests still
    // on their way are stopped first, so none can land afterwards.
    await queryClient.cancelQueries();
    queryClient.clear();
  }
}

let booting: Promise<void> | null = null;

/** Finds out whether a session is open. With no sign of one, it asks nothing. */
export function bootstrapSession(): Promise<void> {
  booting ??= (async () => {
    const store = useSessionStore.getState();
    if (!apiClient.hasSession()) {
      store.setAnonymous();
      return;
    }
    try {
      begin((await apiClient.call(authRoutes.me)).data);
    } catch {
      apiClient.markSessionEnded();
      useSessionStore.getState().setAnonymous();
    }
  })();
  return booting;
}

/** For tests: forget that the app has booted. */
export function resetBootstrap(): void {
  booting = null;
}
