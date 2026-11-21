import { render, screen } from "@testing-library/react";
import { Suspense, use } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { DemoRoles } from "./DemoRoles";

// A badge whose words never finish loading.
vi.mock("@/components/common/DemoBadge", () => ({
  DemoBadge: () => {
    use(new Promise<never>(() => undefined));
    return null;
  },
}));

// The roles read the sign-in words; only the badge words are held back here.
beforeAll(async () => {
  await i18n.loadNamespaces("signin");
});

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

describe("the demo roles when the list has no other roles", () => {
  it("draws the six teams and no More roles control", () => {
    render(
      <Suspense fallback={null}>
        <DemoRoles
          roles={[
            { role: "LOGISTICS", displayName: "Arjun Mehta" },
            { role: "SUPPORT", displayName: "Mei Tan" },
          ]}
          headingId="demo"
          disabled={false}
          onPick={() => undefined}
        />
      </Suspense>,
    );
    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    // The flow order wins over the order the list came in, and the numbers close up.
    expect(names[0]).toMatch(/^1Support/);
    expect(names[1]).toMatch(/^2Logistics/);
    expect(screen.queryByRole("button", { name: "More roles" })).toBeNull();
  });
});
