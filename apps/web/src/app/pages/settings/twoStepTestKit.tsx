// Test-only: the two-step routes on a fake server, and the card in a signed-in role.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { HttpResponse, http, type JsonBodyType } from "msw";
import type { Role, TwoStepStatus } from "@orderpilot/shared";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { errorBody, sessionFor } from "@/test/fixtures";
import { server } from "@/test/server";
import { TwoStepCard } from "./TwoStepCard";

/** The words the card and its dialogs read, loaded once so the first render is not a loading state. */
export async function loadTwoStepWords(): Promise<void> {
  await i18n.loadNamespaces(["common", "settings", "signin", "components"]);
}

export const OFF: TwoStepStatus = {
  state: "off",
  hasPassword: true,
  demoSignInSkips: true,
  demoAdminBlocked: false,
  enabledAt: null,
  recoveryCodesLeft: null,
  lastLockedAt: null,
};

export const ON: TwoStepStatus = {
  ...OFF,
  state: "on",
  enabledAt: "2026-11-20T02:00:00.000Z",
  recoveryCodesLeft: 10,
};

/** A made-up key and made-up codes: obviously fake, low entropy. */
export const SETUP_KEY = "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH";
export const OTPAUTH = `otpauth://totp/OrderPilot:test?secret=${SETUP_KEY}&issuer=OrderPilot`;
export const CODES = Array.from(
  { length: 10 },
  (_, i) => `TESTA-TESTB-TSTC${String(i)}`,
);

const URL_OF = (path: string) => `*/api/v1/auth/two-step${path}`;

export function serveStatus(status: TwoStepStatus) {
  server.use(http.get(URL_OF(""), () => HttpResponse.json({ data: status })));
}

export function serveStatusError(code: Parameters<typeof errorBody>[0]) {
  server.use(
    http.get(URL_OF(""), () =>
      HttpResponse.json(errorBody(code, "trace-status-1"), { status: 500 }),
    ),
  );
}

/** Records every body a route receives, in order. */
export function record(path: string, answer: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(URL_OF(path), async ({ request }) => {
      bodies.push(await request.json());
      return answer();
    }),
  );
  return bodies;
}

export function json(data: JsonBodyType, status = 200): Response {
  return HttpResponse.json(data, { status });
}

export function refusal(
  code: Parameters<typeof errorBody>[0],
  status: number,
  headers: Record<string, string> = {},
): Response {
  return HttpResponse.json(errorBody(code), { status, headers });
}

/** The request gets no answer at all, as when the connection drops. */
export function networkFailure(): Response {
  return HttpResponse.error();
}

export function setupAnswer(): Response {
  return json({
    data: {
      setupKey: SETUP_KEY,
      otpauthUri: OTPAUTH,
      expiresAt: "2026-11-24T12:10:00.000Z",
    },
  });
}

export function codesAnswer(status: TwoStepStatus = ON): Response {
  return json({ data: { recoveryCodes: CODES, status } });
}

/** The card in a role. A password session is a real person; the default is a demo session. */
export function renderCard({
  role = "MANAGEMENT",
  demo = true,
}: { role?: Role; demo?: boolean } = {}) {
  act(() => {
    useSessionStore.getState().setSession({ ...sessionFor(role), demo });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TwoStepCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...ui };
}
