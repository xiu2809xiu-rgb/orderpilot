import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Nothing in the AI module may import a service that writes, approves, pays,
// posts or sends: a model's output can only ever reach the code listed here.
// The check reads the imports of every file, so a new import fails the test
// until a person has decided that the thing it reaches is read-only and adds
// it to the list below, by name, with a reason.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const AI_DIRECTORY = resolve(SRC, "modules/ai");

/** What the AI module may reach outside itself, by path under src/, and why. */
const ALLOWED_OUTSIDE: Readonly<Record<string, string>> = {
  "audit/audit.service.js": "the audit writer, to record a refusal",
  "audit/audit.module.js": "wires the audit writer",
  "auth/permission-policy.js": "the read-only question: may this role use it",
  "auth/auth-context.js": "the shape of a signed-in user, to ask that question",
  "auth/auth.module.js": "provides the permission policy",
  "modules/governance/policy.service.js":
    "area 4's read-only destination policy",
  "modules/governance/governance.module.js": "provides that policy",
  "common/domain-error.js": "the error base class",
  "database/database.js":
    "to see whether a transaction is open, and the usage table",
  "config/app-config.js": "the typed settings",
};

/** Packages a file of the module may use. Anything else, such as a mail or queue client, is a decision. */
function packageAllowed(name: string): boolean {
  return (
    name === "@nestjs/common" ||
    name === "@orderpilot/shared" ||
    name === "zod" ||
    name === "vitest" ||
    name.startsWith("node:")
  );
}

/** Every module specifier a source file imports, statically or with import(). */
export function importsOf(source: string): string[] {
  const found: string[] = [];
  const pattern =
    /(?:^|\s)(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|(?:^|\s)import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

/** The imports of `source`, as it sits at `file`, that the module may not have. */
export function violationsIn(file: string, source: string): string[] {
  const bad: string[] = [];
  for (const specifier of importsOf(source)) {
    if (!specifier.startsWith(".")) {
      if (!packageAllowed(specifier)) bad.push(specifier);
      continue;
    }
    const target = resolve(dirname(file), specifier);
    if (target === AI_DIRECTORY || target.startsWith(AI_DIRECTORY + sep)) {
      continue;
    }
    const underSrc = relative(SRC, target).split(sep).join("/");
    if (!(underSrc in ALLOWED_OUTSIDE)) bad.push(specifier);
  }
  return bad;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    // Tests may import fakes and helpers; the rule is about what runs in production.
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("what the AI module imports", () => {
  const files = sourceFiles(AI_DIRECTORY);

  it("reads the files of the module, so the check below is not empty", () => {
    expect(files.length).toBeGreaterThan(15);
    expect(files.some((file) => file.endsWith("llm-gateway.ts"))).toBe(true);
  });

  it("reaches no service that writes, approves, pays, posts or sends", () => {
    const violations = files.flatMap((file) =>
      violationsIn(file, readFileSync(file, "utf8")).map(
        (specifier) =>
          `${relative(SRC, file).split(sep).join("/")} imports ${specifier}`,
      ),
    );
    expect(violations).toEqual([]);
  });

  describe("the check itself", () => {
    const here = join(AI_DIRECTORY, "llm-gateway.ts");

    it("finds static, type, re-export, side-effect and dynamic imports", () => {
      const source = [
        'import { a } from "./a.js";',
        'import type { B } from "../../x/b.js";',
        'export { c } from "../c.js";',
        'import "./side-effect.js";',
        'const d = await import("../../d.js");',
        "import {",
        "  e,",
        '} from "../e.js";',
      ].join("\n");
      expect(importsOf(source)).toEqual([
        "./a.js",
        "../../x/b.js",
        "../c.js",
        "./side-effect.js",
        "../../d.js",
        "../e.js",
      ]);
    });

    it("flags a workflow, approval, payment or mail service, and a package it has no business with", () => {
      for (const specifier of [
        "../workflows/workflows.service.js",
        "../governance/authorisation.service.js",
        "../orders/orders.service.js",
        "../../queue/queue.service.js",
        "../../storage/storage.service.js",
      ]) {
        expect(violationsIn(here, `import { X } from "${specifier}";`)).toEqual(
          [specifier],
        );
      }
      expect(
        violationsIn(here, 'import nodemailer from "nodemailer";'),
      ).toEqual(["nodemailer"]);
      expect(violationsIn(here, 'const x = await import("bullmq");')).toEqual([
        "bullmq",
      ]);
    });

    it("lets the audit writer, the policies and the module's own files through", () => {
      expect(
        violationsIn(
          here,
          [
            'import { AuditService } from "../../audit/audit.service.js";',
            'import { PolicyService } from "../governance/policy.service.js";',
            'import { PermissionPolicy } from "../../auth/permission-policy.js";',
            'import { x } from "./domain/tool-loop.js";',
            'import { z } from "zod";',
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });
});
