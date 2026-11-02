import { request } from "@playwright/test";
import {
  apiPath,
  authOptionsResponseSchema,
  authRoutes,
  ROLES,
} from "@orderpilot/shared";
import { BASE_URL } from "./env.js";
import { storeSession } from "./session.js";

/**
 * Runs once before the tests. It checks that a stack with the demo sign-in is
 * answering, with a message that says what to do when it is not, then signs
 * in once as each of the nine roles and stores the sessions.
 */
export default async function globalSetup(): Promise<void> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await api
      .get(apiPath(authRoutes.options.path))
      .catch((error: unknown) => {
        throw new Error(
          `Nothing answers at ${BASE_URL} (${String(error)}). Start the stack first: docker compose up --build -d --wait. Or set E2E_BASE_URL to a running one.`,
        );
      });
    if (!res.ok()) {
      throw new Error(
        `${BASE_URL} answered ${String(res.status())} for the sign-in options. Is it an OrderPilot stack, and is it healthy?`,
      );
    }
    const options = authOptionsResponseSchema.parse(await res.json());
    if (!options.data.demoMode) {
      throw new Error(
        `Demo mode is off at ${BASE_URL}. The tests sign in through the demo route: set DEMO_MODE=true.`,
      );
    }
  } finally {
    await api.dispose();
  }
  for (const role of ROLES) await storeSession(role);
}
