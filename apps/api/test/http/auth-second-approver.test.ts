import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import {
  API,
  SECOND_APPROVER_EMAIL,
  call,
  demoSignIn,
  passwordSignIn,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("the account at the top of the approval chain", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("signs in with its email and password and holds the role MANAGEMENT today", async () => {
    const browser = await passwordSignIn(t, SECOND_APPROVER_EMAIL);
    expect(browser.session.user.email).toBe(SECOND_APPROVER_EMAIL);
    expect(browser.session.user.role).toBe("MANAGEMENT");
    expect(browser.session.demo).toBe(false);
    const me = await call(t, browser, "get", `${API}/auth/me`);
    expect(me.status).toBe(200);
  });

  it("is the account the approval setup seed put at the top of the chain", async () => {
    const top = await passwordSignIn(t, SECOND_APPROVER_EMAIL);
    const approver = await demoSignIn(t, "APPROVER");
    const setups = t.app.get(ApprovalSetupRepository);
    expect(await setups.find(approver.session.user.id)).toMatchObject({
      approverId: top.session.user.id,
    });
    expect(await setups.find(top.session.user.id)).toMatchObject({
      unlimitedSalesApproval: true,
      unlimitedPurchaseApproval: true,
      approverId: null,
    });
  });
});
