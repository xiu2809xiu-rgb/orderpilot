import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

/**
 * The shell asks for the signed-in person's availability whenever it draws, so
 * a test that names no handler for it would send a real request: to whatever
 * answers on the jsdom address, such as a developer's own API, which counts the
 * call and may be slow. These two answers are Available, and any test that
 * cares overrides them with `server.use`.
 */
const availabilityDefaults = [
  http.get("*/api/v1/availability/mine", () =>
    HttpResponse.json({
      data: { value: "AVAILABLE", setAt: null, expiresAt: null },
    }),
  ),
  http.get("*/api/v1/availability", ({ request }) =>
    HttpResponse.json({
      data: (new URL(request.url).searchParams.get("ids") ?? "")
        .split(",")
        .filter((id) => id !== "")
        .map((userId) => ({ userId, value: "AVAILABLE", setAt: null })),
    }),
  ),
];

/**
 * One MSW server for every test file (set up in setup.ts). Apart from the
 * availability answers above it starts with no handlers: a test adds the ones
 * it needs, from the generated mocks (`getSystemMock()` and the like in
 * lib/api/generated/endpoints) or its own, and setup.ts clears them after each
 * test.
 */
export const server = setupServer(...availabilityDefaults);
