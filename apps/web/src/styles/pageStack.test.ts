import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.join(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");

/** The pages whose root is the one page stack (docs/design/design-system.md). */
const PAGES = [
  "app/pages/SettingsPage.tsx",
  "components/document-form/DocumentForm.tsx",
  "features/audit/AuditPage.tsx",
  "features/directions/screens/home/HomeBody.tsx",
  "features/directions/screens/order/OrderPage.tsx",
  "features/directions/screens/upload/UploadScreen.tsx",
  "features/exceptions/ExceptionsPage.tsx",
  "features/governance/GovernancePage.tsx",
  "features/insights/InsightsPage.tsx",
  "features/master-data/RecordState.tsx",
  "features/monitoring/MonitoringPage.tsx",
  "features/order-tracker/OrderDetailPage.tsx",
  "features/order-tracker/OrderTrackerPage.tsx",
  "features/workflows/OrderStepsPage.tsx",
  "features/workflows/RemindersPage.tsx",
  "features/workflows/SprApprovalPage.tsx",
  "features/workflows/WorkflowsPage.tsx",
];

describe("the page stack", () => {
  it("is one flex column spaced by --dx-stack, with the head pulled back to the head gap", () => {
    const css = read("styles/surfaces.css");
    expect(css).toContain("gap: var(--dx-stack);");
    expect(css).toContain(
      "margin-bottom: calc(var(--dx-head-gap) - var(--dx-stack));",
    );
  });

  it.each(PAGES)(
    "is the root of %s, in place of its own space-y or gap",
    (file) => {
      const code = read(file);
      expect(code).toContain("dx-page");
      // A root that spaces its own children brings back a second rhythm.
      expect(code).not.toContain('<div className="space-y-s4">');
      expect(code).not.toContain('"dx-sheet flex flex-col gap-s');
    },
  );
});
