import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockServer } from "./server.js";

describe("the mock service contract", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createMockServer();
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });
  afterAll(() => {
    server.close();
  });

  it("answers its health check and says it is a mock", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-mock-service")).toBe("mock-template");
    expect(await res.json()).toMatchObject({ status: "ok", mock: true });
  });

  it("answers anything else with the one error envelope", async () => {
    const res = await fetch(`${base}/anything`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: { code: "NOT_FOUND", details: [] },
    });
  });

  it("refuses a write to its health route", async () => {
    const res = await fetch(`${base}/health`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
