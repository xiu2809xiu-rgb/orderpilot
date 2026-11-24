import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Availability is information for colleagues and nothing else (ADR 0070):
// no reminder, escalation, approval or routing rule may read it. This test
// reads every source file of the API outside the feature and fails on any way
// to reach it: the table, the model's delegate, a raw query, the relation on
// User, the module, or any name of the shared contract. A future screen or
// route that is meant to show it adds its own file to a list on purpose, in
// its own pull request.
//
// It is a net and not a proof. A determined change could reach the table by a
// path these terms do not cover. It catches the ordinary ways.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FEATURE = join(SRC, "modules", "availability");
const SHARED_FILE = resolve(
  SRC,
  "../../../packages/shared/src/person-availability.ts",
);

/** Under src/, what may name the feature: itself, its one registration, and the generated client. */
const SKIPPED = [
  FEATURE,
  join(SRC, "app.module.ts"),
  join(SRC, "generated", "prisma"),
];

function isSkipped(path: string): boolean {
  return SKIPPED.some(
    (skipped) => path === skipped || path.startsWith(skipped + sep),
  );
}

/** Every non-test TypeScript file under a folder. */
function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"));
}

/** The names the shared contract exports, read from the file itself. */
function sharedExportNames(): string[] {
  const text = readFileSync(SHARED_FILE, "utf8");
  const names: string[] = [];
  const declaration = /export (?:const|function|type|interface) (\w+)/g;
  for (const match of text.matchAll(declaration)) {
    if (match[1] !== undefined) names.push(match[1]);
  }
  return names;
}

/** The classes of the feature, read from its files: whoever imports one is reading it. */
function featureClassNames(): string[] {
  const names: string[] = [];
  for (const path of sourceFilesUnder(FEATURE)) {
    const declaration = /export (?:abstract )?class (\w+)/g;
    for (const match of readFileSync(path, "utf8").matchAll(declaration)) {
      if (match[1] !== undefined) names.push(match[1]);
    }
  }
  return names;
}

const FIXED_TERMS = [
  // The table, the model's delegate (userAvailability) and raw SQL on it.
  "useravailability",
  // The relation on User, so `include: { personAvailability: true }` is caught.
  "personavailability",
  "person_availabilit",
  "modules/availability",
  // A sibling module reaches it by a relative path with no "modules/" in it.
  "/availability/availability.",
];

/** The terms that appear in a text, case-insensitively. Pure, so it can be fed bad text. */
function forbiddenIn(text: string, terms: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

/** Where the feature may not reach: what writes, audits, queues, routes or approves. */
const FORBIDDEN_IMPORTS = [
  "audit/audit.service",
  "audit/audit.module",
  "modules/audit",
  "modules/workflows",
  "modules/governance",
  "modules/checks",
  "modules/analytics",
  "queue/",
  "worker/",
];

function importsOf(text: string): string[] {
  const specifiers: string[] = [];
  for (const match of text.matchAll(/from\s+"([^"]+)"/g)) {
    if (match[1] !== undefined) specifiers.push(match[1]);
  }
  return specifiers;
}

describe("availability is information only", () => {
  const terms = [
    ...FIXED_TERMS,
    ...sharedExportNames(),
    ...featureClassNames(),
  ];

  it("reads the names of the shared contract from its file", () => {
    expect(terms).toEqual(
      expect.arrayContaining([
        "PERSON_AVAILABILITIES",
        "personAvailabilitySchema",
        "PersonAvailability",
        "personAvailabilityRoutes",
        "lookupIdsOf",
        "AvailabilityRepository",
        "AvailabilityRules",
      ]),
    );
  });

  it("reads source files, so the next test is not an empty loop", () => {
    const files = sourceFilesUnder(SRC).filter((path) => !isSkipped(path));
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((path) => path.endsWith("user.repository.ts"))).toBe(
      true,
    );
  });

  it("names the table, the relation, the module or the shared contract in no file outside the feature", () => {
    const hits = sourceFilesUnder(SRC)
      .filter((path) => !isSkipped(path))
      .flatMap((path) =>
        forbiddenIn(readFileSync(path, "utf8"), terms).map(
          (term) => `${relative(SRC, path)}: ${term}`,
        ),
      );
    expect(hits).toEqual([]);
  });

  it("flags each way of reading it that the scanner exists to catch", () => {
    const bad = [
      "const row = await tx.user.findFirst({ include: { personAvailability: true } });",
      "await database.client.userAvailability.findMany({});",
      'await database.client.$queryRaw`SELECT * FROM "UserAvailability"`;',
      'import { AvailabilityRepository } from "../availability/availability.repository.js";',
      'import { AvailabilityModule } from "../modules/availability/availability.module.js";',
      'import { personAvailabilitySchema } from "@orderpilot/shared";',
      'import { PERSON_AVAILABILITIES } from "@orderpilot/shared";',
    ];
    for (const text of bad) {
      expect(forbiddenIn(text, terms), text).not.toEqual([]);
    }
    expect(forbiddenIn("const stock = itemAvailability(row);", terms)).toEqual(
      [],
    );
  });

  it("imports no audit, workflow, governance, checks, analytics, queue or worker code from inside the feature", () => {
    const files = sourceFilesUnder(FEATURE);
    expect(files.length).toBeGreaterThanOrEqual(4);
    const hits = files.flatMap((path) =>
      importsOf(readFileSync(path, "utf8")).flatMap((specifier) =>
        FORBIDDEN_IMPORTS.filter((forbidden) =>
          specifier.includes(forbidden),
        ).map(
          (forbidden) => `${relative(SRC, path)}: ${specifier} (${forbidden})`,
        ),
      ),
    );
    expect(hits).toEqual([]);
  });

  it("flags an import of each place the feature must stay out of", () => {
    for (const forbidden of FORBIDDEN_IMPORTS) {
      const text = `import { X } from "../../${forbidden}x.js";`;
      expect(
        importsOf(text).some((specifier) => specifier.includes(forbidden)),
        forbidden,
      ).toBe(true);
    }
  });
});
