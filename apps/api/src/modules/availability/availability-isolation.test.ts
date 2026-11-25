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
// path these terms do not cover. It catches the ordinary ways. ADR 0070 lists
// what it does not cover.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FEATURE = join(SRC, "modules", "availability");
const SHARED_FILE = resolve(
  SRC,
  "../../../packages/shared/src/person-availability.ts",
);

const APP_MODULE = join(SRC, "app.module.ts");
const MIGRATIONS = resolve(SRC, "../prisma/migrations");
/** The one migration that may name the table: this story's own. */
const OWN_MIGRATION = join(MIGRATIONS, "20261125100000_user_availability");

/** Under src/, what may name the feature: itself and the generated client. The app module is read on its own, line by line. */
const SKIPPED = [FEATURE, APP_MODULE, join(SRC, "generated", "prisma")];

/** The only two lines of the app module that may name the feature: its import and its entry in `imports`. */
const APP_MODULE_IMPORT =
  'import { AvailabilityModule } from "./modules/availability/availability.module.js";';
const APP_MODULE_ENTRY = "AvailabilityModule,";

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

/** Every SQL file of the migrations. */
function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => join(entry.parentPath, entry.name));
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

/** What a migration may not name: the table and its enum. */
const SQL_TERMS = ["useravailability", "person_availabilit"];

/** The terms that appear in a text, case-insensitively. Pure, so it can be fed bad text. */
function forbiddenIn(text: string, terms: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

/**
 * What in the app module names the feature, other than its import line and its
 * one entry before `providers:`. A provider, a guard or a second entry that
 * injects or lists the feature is a hit.
 */
function appModuleHits(text: string, terms: readonly string[]): string[] {
  const providersAt = text.indexOf("providers:");
  const hits: string[] = [];
  const spare = new Map([
    [APP_MODULE_IMPORT, 1],
    [APP_MODULE_ENTRY, 1],
  ]);
  let offset = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const left = spare.get(trimmed) ?? 0;
    if (left > 0 && (providersAt < 0 || offset < providersAt)) {
      spare.set(trimmed, left - 1);
    } else {
      hits.push(
        ...forbiddenIn(line, terms).map((term) => `${trimmed}: ${term}`),
      );
    }
    offset += line.length + 1;
  }
  return hits;
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

  it("names it in the app module on only two lines: its import and its one entry in imports", () => {
    const text = readFileSync(APP_MODULE, "utf8");
    expect(text).toContain(APP_MODULE_IMPORT);
    expect(text).toContain(APP_MODULE_ENTRY);
    expect(appModuleHits(text, terms)).toEqual([]);
  });

  it("flags a provider or a second entry in the app module that names the feature", () => {
    const real = readFileSync(APP_MODULE, "utf8");
    const withProvider = real.replace(
      "providers: [",
      "providers: [\n        { provide: APP_GUARD, useClass: BusyGuard, inject: [AvailabilityService] },",
    );
    expect(withProvider).not.toBe(real);
    expect(appModuleHits(withProvider, terms)).not.toEqual([]);
    const withSecondEntry = real.replace(
      "{ provide: APP_GUARD, useClass: ThrottlerGuard },",
      "{ provide: APP_GUARD, useClass: ThrottlerGuard },\n        AvailabilityModule,",
    );
    expect(withSecondEntry).not.toBe(real);
    expect(appModuleHits(withSecondEntry, terms)).not.toEqual([]);
    const withSecondImport = `${APP_MODULE_IMPORT}\n${real}`;
    expect(appModuleHits(withSecondImport, terms)).not.toEqual([]);
  });

  it("reads the migrations, so the next test is not an empty loop", () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((path) => path.startsWith(OWN_MIGRATION + sep))).toBe(
      true,
    );
  });

  it("names the table in no migration but this story's own", () => {
    const hits = migrationFiles()
      .filter((path) => !path.startsWith(OWN_MIGRATION + sep))
      .flatMap((path) =>
        forbiddenIn(readFileSync(path, "utf8"), SQL_TERMS).map(
          (term) => `${relative(MIGRATIONS, path)}: ${term}`,
        ),
      );
    expect(hits).toEqual([]);
  });

  it("flags each way a later migration could reach the table", () => {
    const bad = [
      'CREATE VIEW "ReachableApprovers" AS SELECT u."id" FROM "User" u JOIN "UserAvailability" a ON a."userId" = u."id";',
      'CREATE FUNCTION skip_busy() RETURNS trigger AS $$ BEGIN PERFORM 1 FROM "UserAvailability"; RETURN NEW; END $$ LANGUAGE plpgsql;',
      `ALTER TYPE "UserAvailabilityState" ADD VALUE 'AWAY';`,
    ];
    for (const text of bad) {
      expect(forbiddenIn(text, SQL_TERMS), text).not.toEqual([]);
    }
    expect(forbiddenIn('SELECT * FROM "User";', SQL_TERMS)).toEqual([]);
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
