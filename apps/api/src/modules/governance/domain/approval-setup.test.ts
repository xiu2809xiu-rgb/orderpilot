import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import {
  assertValidSetup,
  changesBetween,
  isAway,
  type ApprovalSetup,
} from "./approval-setup.js";

const USER = "00000000-0000-4000-8000-000000000002";
const OTHER = "00000000-0000-4000-8000-000000000003";
const NOW = new Date("2026-11-03T09:00:00.000Z");

const setup = (overrides: Partial<ApprovalSetup> = {}): ApprovalSetup => ({
  userId: USER,
  approverId: OTHER,
  salesAmountApprovalLimit: "20000.00",
  purchaseAmountApprovalLimit: "5000.00",
  unlimitedSalesApproval: false,
  unlimitedPurchaseApproval: false,
  substituteUserId: null,
  awayFrom: null,
  awayUntil: null,
  ...overrides,
});

/** The fields a refusal names, so a form can point at the right one. */
function refusedPaths(row: ApprovalSetup): string[] {
  try {
    assertValidSetup(row);
    return [];
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    expect(error.code).toBe("VALIDATION_FAILED");
    return (error.details ?? []).map((issue) => issue.path);
  }
}

describe("a valid approval setup", () => {
  it("accepts the sample row", () => {
    expect(refusedPaths(setup())).toEqual([]);
    expect(
      refusedPaths(
        setup({
          substituteUserId: OTHER,
          awayFrom: NOW,
          awayUntil: new Date(NOW.getTime() + 1),
        }),
      ),
    ).toEqual([]);
  });

  it("never lets anyone be their own substitute", () => {
    expect(refusedPaths(setup({ substituteUserId: USER }))).toEqual([
      "substituteUserId",
    ]);
  });

  it("needs an absence to start before it can end, and to end after it starts", () => {
    expect(refusedPaths(setup({ awayUntil: NOW }))).toEqual(["awayUntil"]);
    expect(refusedPaths(setup({ awayFrom: NOW, awayUntil: NOW }))).toEqual([
      "awayUntil",
    ]);
    expect(
      refusedPaths(
        setup({ awayFrom: NOW, awayUntil: new Date(NOW.getTime() - 1) }),
      ),
    ).toEqual(["awayUntil"]);
  });

  it("needs each limit to be zero or more, in whole cents", () => {
    expect(
      refusedPaths(
        setup({
          salesAmountApprovalLimit: "-1.00",
          purchaseAmountApprovalLimit: "10.005",
        }),
      ),
    ).toEqual(["salesAmountApprovalLimit", "purchaseAmountApprovalLimit"]);
  });
});

describe("whether someone is away", () => {
  it("is false with no absence, and true from awayFrom until awayUntil", () => {
    expect(isAway(setup(), NOW)).toBe(false);
    const until = new Date(NOW.getTime() + 60_000);
    const row = setup({ awayFrom: NOW, awayUntil: until });
    expect(isAway(row, new Date(NOW.getTime() - 1))).toBe(false);
    expect(isAway(row, NOW)).toBe(true);
    expect(isAway(row, until)).toBe(false);
  });
});

describe("what a change to an approval setup records", () => {
  it("records every field as after, with no before, for a new row", () => {
    const changes = changesBetween(null, setup());
    expect(changes?.before).toBeNull();
    expect(changes?.after).toMatchObject({
      approverId: OTHER,
      purchaseAmountApprovalLimit: "5000.00",
      unlimitedPurchaseApproval: false,
      awayFrom: null,
    });
  });

  it("records only the fields that changed, before and after", () => {
    const awayFrom = new Date("2026-11-10T00:00:00.000Z");
    expect(
      changesBetween(
        setup(),
        setup({ purchaseAmountApprovalLimit: "6000.00", awayFrom }),
      ),
    ).toEqual({
      before: { purchaseAmountApprovalLimit: "5000.00", awayFrom: null },
      after: {
        purchaseAmountApprovalLimit: "6000.00",
        awayFrom: "2026-11-10T00:00:00.000Z",
      },
    });
  });

  it("records nothing when nothing changed, however the amounts are written", () => {
    expect(changesBetween(setup(), setup())).toBeNull();
    expect(
      changesBetween(
        setup({ purchaseAmountApprovalLimit: "5000" }),
        setup({ purchaseAmountApprovalLimit: "5000.00" }),
      ),
    ).toBeNull();
    expect(
      changesBetween(
        setup({ awayFrom: new Date(NOW) }),
        setup({ awayFrom: new Date(NOW) }),
      ),
    ).toBeNull();
  });
});
