import { INBOX_ROLES, ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import { InboxScope } from "./inbox-scope.js";

describe("InboxScope", () => {
  it("gives a role with an inbox its own", () => {
    for (const role of INBOX_ROLES) expect(InboxScope.own(role)).toBe(role);
  });

  it("refuses a role with no inbox, which opens others by permission instead", () => {
    const without = ROLES.filter((r) => !INBOX_ROLES.some((i) => i === r));
    expect(without.length).toBeGreaterThan(0);
    for (const role of without) {
      expect(() => InboxScope.own(role)).toThrow(DomainError);
    }
  });
});
