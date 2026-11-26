import { authOptionsSchema } from "@orderpilot/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { offeredAccounts } from "../../src/auth/demo-accounts.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { API } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

async function optionsOf(t: TestApp) {
  const res = await request(t.app.getHttpServer()).get(`${API}/auth/options`);
  expect(res.status).toBe(200);
  return authOptionsSchema.parse((res.body as { data: unknown }).data);
}

describe("the sign-in options carry the demo accounts' ids (ADR 0070)", () => {
  describe("in demo mode", () => {
    let t: TestApp;
    beforeAll(async () => {
      await resetTestData();
      t = await createTestApp({ DEMO_MODE: "true" });
    });
    afterAll(async () => {
      await t.close();
    });

    it("carries the seeded id of every offered account, each equal to the seeded user's id found by email", async () => {
      const options = await optionsOf(t);
      const offered = offeredAccounts();
      expect(options.demoRoles).toHaveLength(offered.length);
      const users = t.app.get(UserRepository);
      for (const account of offered) {
        const entry = options.demoRoles.find((r) => r.role === account.role);
        const seeded = await users.findByEmail(account.email);
        expect(seeded, account.email).not.toBeNull();
        expect(entry?.userId, account.role).toBe(seeded?.id);
      }
    });

    it("carries no field but the role, the name and the id", async () => {
      const res = await request(t.app.getHttpServer()).get(
        `${API}/auth/options`,
      );
      const entries = (res.body as { data: { demoRoles: object[] } }).data
        .demoRoles;
      for (const entry of entries) {
        expect(Object.keys(entry).sort()).toEqual([
          "displayName",
          "role",
          "userId",
        ]);
      }
    });

    it("leaves an account that is disabled without an id", async () => {
      const users = t.app.get(UserRepository);
      const [first] = offeredAccounts();
      const seeded = await users.findByEmail(first?.email ?? "");
      await users.setDisabledAt(seeded?.id ?? "", new Date());
      try {
        const entry = (await optionsOf(t)).demoRoles.find(
          (r) => r.role === first?.role,
        );
        expect(entry).toBeDefined();
        expect(entry?.userId).toBeUndefined();
      } finally {
        await users.setDisabledAt(seeded?.id ?? "", null);
      }
    });
  });

  it("leaves an account that is not seeded without an id", async () => {
    await resetTestData({ seed: false });
    const t = await createTestApp({ DEMO_MODE: "true" });
    try {
      const options = await optionsOf(t);
      expect(options.demoRoles).toHaveLength(offeredAccounts().length);
      for (const entry of options.demoRoles) {
        expect(entry.userId).toBeUndefined();
      }
    } finally {
      await t.close();
      await resetTestData();
    }
  });

  it("carries no id outside demo mode", async () => {
    await resetTestData();
    const t = await createTestApp({ DEMO_MODE: "false" });
    try {
      const res = await request(t.app.getHttpServer()).get(
        `${API}/auth/options`,
      );
      expect((res.body as { data: unknown }).data).toEqual({
        demoMode: false,
        demoRoles: [],
      });
      expect(JSON.stringify(res.body)).not.toMatch(/userId/);
    } finally {
      await t.close();
    }
  });
});
