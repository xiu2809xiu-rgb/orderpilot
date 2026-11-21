import { ROLES, STORED_ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { Role as PrismaRole } from "../generated/prisma/enums.js";

describe("the stored roles (ADR 0058)", () => {
  it("are the values of the database's role type, one for one", () => {
    expect([...STORED_ROLES].sort()).toEqual(Object.values(PrismaRole).sort());
  });

  it("hold every role a user can have", () => {
    for (const role of ROLES) expect(Object.values(PrismaRole)).toContain(role);
  });
});
