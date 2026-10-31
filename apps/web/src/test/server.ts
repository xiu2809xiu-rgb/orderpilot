import { setupServer } from "msw/node";

/**
 * One MSW server for every test file (set up in setup.ts). It starts with no
 * handlers: a test adds the ones it needs, from the generated mocks
 * (`getSystemMock()` and the like in lib/api/generated/endpoints) or its own,
 * and setup.ts clears them after each test.
 */
export const server = setupServer();
