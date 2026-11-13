import { Plus } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionFor } from "@/test/fixtures";
import { actionsFor, actionsForRole, listActions, registerAction } from ".";

const added: (() => void)[] = [];
afterEach(() => {
  added.splice(0).forEach((remove) => {
    remove();
  });
});

function add(
  id: string,
  permission?: Parameters<typeof registerAction>[0]["permission"],
) {
  const run = vi.fn();
  added.push(registerAction({ id, label: id, icon: Plus, permission, run }));
  return run;
}

describe("action registry", () => {
  it("has the actions that exist today", () => {
    const ids = listActions().map((action) => action.id);
    expect(ids).toEqual(
      expect.arrayContaining(["theme.light", "theme.dark", "session.signOut"]),
    );
  });

  it("registers an action in one call and removes it again", () => {
    add("test.one");
    expect(listActions().map((a) => a.id)).toContain("test.one");
    added.pop()?.();
    expect(listActions().map((a) => a.id)).not.toContain("test.one");
  });

  it("replaces an action registered again with the same id", () => {
    add("test.same");
    add("test.same");
    expect(listActions().filter((a) => a.id === "test.same")).toHaveLength(1);
  });

  it("filters by the session's permissions", () => {
    add("test.audit", "audit.read");
    const admin = sessionFor("SYSTEM_ADMIN");
    const support = sessionFor("SUPPORT");
    expect(admin.permissions).toContain("audit.read");
    expect(support.permissions).not.toContain("audit.read");
    expect(actionsFor(admin).map((a) => a.id)).toContain("test.audit");
    expect(actionsFor(support).map((a) => a.id)).not.toContain("test.audit");
    // Nobody signed in: nothing.
    expect(actionsFor(null)).toEqual([]);
  });

  it("reads the actions for a role, for its quick actions", () => {
    add("test.audit", "audit.read");
    add("test.open");
    expect(actionsForRole("SYSTEM_ADMIN").map((a) => a.id)).toContain(
      "test.audit",
    );
    expect(actionsForRole("SUPPORT").map((a) => a.id)).not.toContain(
      "test.audit",
    );
    expect(actionsForRole("SUPPORT").map((a) => a.id)).toContain("test.open");
  });
});
