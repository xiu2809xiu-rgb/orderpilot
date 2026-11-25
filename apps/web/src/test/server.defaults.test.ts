import { describe, expect, it } from "vitest";

// The shell asks for availability whenever it draws. If these answers were
// missing, a test that names no handler would send a real request to whatever
// listens on the jsdom address, such as a developer's own API.
const BASE = "http://localhost:3000/api/v1";

describe("the test server's own answers for availability", () => {
  it("answers the person's availability as Available with no times", async () => {
    const answer = await fetch(`${BASE}/availability/mine`);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      data: { value: "AVAILABLE", setAt: null, expiresAt: null },
    });
  });

  it("answers a lookup with one Available entry for each id asked, in order", async () => {
    const answer = await fetch(`${BASE}/availability?ids=b-id,a-id`);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      data: [
        { userId: "b-id", value: "AVAILABLE", setAt: null },
        { userId: "a-id", value: "AVAILABLE", setAt: null },
      ],
    });
  });
});
