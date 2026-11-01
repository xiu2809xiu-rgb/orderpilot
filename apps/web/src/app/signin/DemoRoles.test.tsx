import { render, screen } from "@testing-library/react";
import { Suspense, use } from "react";
import { describe, expect, it, vi } from "vitest";
import { DemoRoles } from "./DemoRoles";

// A badge whose words never finish loading.
vi.mock("@/components/common/DemoBadge", () => ({
  DemoBadge: () => {
    use(new Promise<never>(() => undefined));
    return null;
  },
}));

describe("the demo roles while the badge words load", () => {
  it("stay on screen: only the badge waits", () => {
    render(
      <Suspense fallback={<p>Whole page waiting</p>}>
        <DemoRoles
          roles={[{ role: "FINANCE", displayName: "Grace Ong" }]}
          headingId="demo"
          disabled={false}
          onPick={() => undefined}
        />
      </Suspense>,
    );
    expect(screen.queryByText("Whole page waiting")).toBeNull();
    expect(screen.getByRole("button", { name: /Grace Ong/ })).toBeEnabled();
  });
});
