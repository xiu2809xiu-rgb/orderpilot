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
