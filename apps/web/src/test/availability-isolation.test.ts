import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Availability is information for colleagues and changes no rule (ADR 0070).
// "No code outside this feature may read it" is a promise about future code, so
// this test scans the web package for the feature's names, its route and its
// generated client, and fails on any file that is not on the list below. A
// follow-up that shows availability on its own screen adds its file to the list
// in its own pull request, on purpose: a screen may show it, a rule may not read
// it. It is a net and not a proof: it cannot see a name built from pieces.

const SRC = join(import.meta.dirname, "..");
const SHARED = join(
  import.meta.dirname,
  "../../../../packages/shared/src/person-availability.ts",
);

/** The files that may name availability, relative to apps/web/src with forward slashes. */
const ALLOWED_FILES = new Set([
  "lib/useAvailability.ts",
  "lib/useAvailabilityOf.ts",
  "lib/useExpiryTimer.ts",
  "app/shell/UserMenu.tsx",
  "app/shell/RoleSwitcher.tsx",
  "app/shell/RoleItem.tsx",
  "app/pages/settings/ProfileCard.tsx",
  "app/pages/settings/ProfileAvatar.tsx",
  "app/pages/settings/AvailabilityRow.tsx",
  "app/pages/settings/AvailabilityRefused.tsx",
  "components/parts/UserAvatar.tsx",
  "test/fixtures.ts",
]);
const ALLOWED_FOLDERS = [
  "components/kit/availability-picker/",
  // Written by orval and compared byte for byte by pnpm api:check.
  "lib/api/generated/",
];

/** The names the shared contract exports, read as text with a literal pattern. */
function sharedNames(): string[] {
  const source = readFileSync(SHARED, "utf8");
  return [
    ...source.matchAll(/^export (?:const|function|type|interface) (\w+)/gm),
  ].flatMap((m) => (m[1] ? [m[1]] : []));
}

/** Terms that mean "this file reads availability", lower case. */
function terms(): string[] {
  return [
    "useavailability",
    "useavailabilityof",
    "availability-picker",
    "person-availability",
    "personavailabilityroutes",
    "/availability",
    // The generated hooks and models of the three routes.
    "endpoints/availability",
    "model/availability",
    "availabilitymine",
    "availabilityset",
    "availabilitylookup",
    ...sharedNames().map((name) => name.toLowerCase()),
  ];
}

/** The terms found in some text, case-insensitively. */
function termsIn(text: string, list: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return list.filter((term) => lower.includes(term));
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function sourceFiles() {
  return walk(SRC)
    .map((full) => ({ full, rel: relative(SRC, full).split(sep).join("/") }))
    .filter(
      ({ rel }) =>
        /\.(ts|tsx)$/.test(rel) &&
        !/\.test\.(ts|tsx)$/.test(rel) &&
        !ALLOWED_FOLDERS.some((folder) => rel.startsWith(folder)),
    );
}

describe("availability stays information only (web)", () => {
  it("reads the shared names at test time, so a new export is watched at once", () => {
    const names = sharedNames();
    expect(names).toContain("PERSON_AVAILABILITIES");
    expect(names).toContain("personAvailabilityRoutes");
    expect(names).toContain("lookupIdsOf");
    expect(names.length).toBeGreaterThan(15);
  });

  it("finds known-bad text, so the scanner cannot pass by finding nothing", () => {
    const list = terms();
    for (const bad of [
      'import { useAvailability } from "@/lib/useAvailability";',
      'import { availabilityLookup } from "@/lib/api/generated/endpoints/availability/availability";',
      'import { Picker } from "@/components/kit/availability-picker/AvailabilityControl";',
      'apiClient.request({ url: "/api/v1/availability?ids=1" })',
      "const x: PersonAvailability = 'FOCUSING';",
      'import { personAvailabilityRoutes } from "@orderpilot/shared";',
    ]) {
      expect(termsIn(bad, list), bad).not.toEqual([]);
    }
    expect(termsIn("const stock = itemAvailability(1);", list)).toEqual([]);
  });

  it("names availability in no file outside the feature and the places that show it", () => {
    const list = terms();
    const found = sourceFiles()
      .filter(({ rel }) => !ALLOWED_FILES.has(rel))
      .flatMap(({ full, rel }) =>
        termsIn(readFileSync(full, "utf8"), list).map(
          (term) => `${rel}: ${term}`,
        ),
      );
    expect(found).toEqual([]);
  });

  it("has every allowed file really in the package, so the list cannot go stale", () => {
    const present = new Set(sourceFiles().map(({ rel }) => rel));
    for (const file of ALLOWED_FILES) {
      expect(present.has(file), file).toBe(true);
    }
  });

  it("sends no analytics event for it from any allowed file", () => {
    const found = sourceFiles()
      .filter(({ rel }) => ALLOWED_FILES.has(rel))
      .filter(({ full }) =>
        /AnalyticsTracker|\btrack\(|analytics/i.test(
          readFileSync(full, "utf8"),
        ),
      )
      .map(({ rel }) => rel);
    const inKit = walk(join(SRC, "components/kit/availability-picker"))
      .filter((file) => !/\.test\.(ts|tsx)$/.test(file))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) =>
        /AnalyticsTracker|\btrack\(|analytics/i.test(
          readFileSync(file, "utf8"),
        ),
      );
    expect([...found, ...inKit]).toEqual([]);
  });
});
