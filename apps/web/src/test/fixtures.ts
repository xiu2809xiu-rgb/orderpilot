import {
  DEFAULT_ROLE_PERMISSIONS,
  DEMO_PERSONAS,
  ROLES,
  type AuthOptions,
  type ErrorCode,
  type Role,
  type Session,
  ERROR_HTTP_STATUS,
} from "@orderpilot/shared";
import { vi } from "vitest";

export function sessionFor(role: Role, expiresInMs = 15 * 60_000): Session {
  const index = ROLES.indexOf(role) + 1;
  return {
    user: {
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      displayName: DEMO_PERSONAS[role],
      email: `${role.toLowerCase().replaceAll("_", ".")}@example.test`,
      role,
    },
    permissions: [...DEFAULT_ROLE_PERMISSIONS[role]],
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    demo: true,
  };
}

export function optionsFixture(demoMode: boolean): AuthOptions {
  return {
    demoMode,
    demoRoles: demoMode
      ? ROLES.map((role) => ({ role, displayName: DEMO_PERSONAS[role] }))
      : [],
  };
}

export function errorBody(code: ErrorCode, traceId = "trace-test-1") {
  return {
    error: { code, message: "server message", details: null, traceId },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface MockApiState {
  demoMode: boolean;
  /** The session `/auth/me` and `/auth/refresh` answer with; null means 401. */
  session: Session | null;
  refreshWorks: boolean;
  password: string;
}

/** A fake API for the auth contract. Calls are recorded in `fetch.mock.calls`. */
export function mockApi(initial: Partial<MockApiState> = {}) {
  const state: MockApiState = {
    demoMode: true,
    session: null,
    refreshWorks: true,
    password: "correct-horse",
    ...initial,
  };

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
      "http://localhost",
    );
    const route = `${init?.method ?? "GET"} ${url.pathname.replace("/api/v1", "")}`;
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as unknown)
        : null;

    switch (route) {
      case "GET /auth/options":
        return Promise.resolve(
          json(200, { data: optionsFixture(state.demoMode) }),
        );
      case "GET /auth/me":
        return Promise.resolve(
          state.session
            ? json(200, { data: state.session })
            : json(
                ERROR_HTTP_STATUS.UNAUTHENTICATED,
                errorBody("UNAUTHENTICATED"),
              ),
        );
      case "POST /auth/demo-login": {
        const { role } = body as { role: Role };
        state.session = sessionFor(role);
        return Promise.resolve(json(200, { data: state.session }));
      }
      case "POST /auth/login": {
        const { password } = body as { password: string };
        if (password !== state.password) {
          return Promise.resolve(
            json(401, errorBody("INVALID_CREDENTIALS", "trace-bad-login")),
          );
        }
        state.session = sessionFor("SUPPORT");
        return Promise.resolve(json(200, { data: state.session }));
      }
      case "POST /auth/refresh":
        return Promise.resolve(
          state.refreshWorks && state.session
            ? json(200, { data: state.session })
            : json(401, errorBody("SESSION_EXPIRED")),
        );
      case "POST /auth/logout":
        state.session = null;
        return Promise.resolve(json(200, { data: { ok: true } }));
      default:
        return Promise.resolve(json(404, errorBody("NOT_FOUND")));
    }
  });

  return { state, fetch: fetchMock };
}
