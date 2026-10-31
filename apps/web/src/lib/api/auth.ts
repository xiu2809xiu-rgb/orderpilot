import {
  authRoutes,
  type AuthOptions,
  type LoginRequest,
  type Role,
  type Session,
} from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";
import { apiClient } from "./instance";

export async function fetchAuthOptions(): Promise<AuthOptions> {
  return (await apiClient.call(authRoutes.options)).data;
}

function begin(session: Session): Session {
  apiClient.markSessionStarted();
  useSessionStore.getState().setSession(session);
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
    apiClient.markSessionEnded();
    useSessionStore.getState().setAnonymous();
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
