import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { MasterDataModule } from "../master-data/master-data.module.js";
import { MasterDataService } from "../master-data/master-data.service.js";
import { OrdersModule } from "../orders/orders.module.js";
import { OrdersService } from "../orders/orders.service.js";
import { OrdersWriteService } from "../orders/orders-write.service.js";

// Nothing in the Spark module may import a service that writes, approves, pays,
// posts or sends: what a model says can only ever reach the code listed here.
// It is the AI module's check (ai-imports.test.ts), made for Spark. A new
// import fails the test until a person has decided that what it reaches is
// read-only and adds it below, by name, with a reason. Spark's tools reach two
// read services, named below, and no other service of orders or master data.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPARK_DIRECTORY = resolve(SRC, "modules/spark");

/** What the Spark module may reach outside itself, by path under src/, and why. */
const ALLOWED_OUTSIDE: Readonly<Record<string, string>> = {
  "modules/ai/llm-gateway.js":
    "the one way to a model: it reads, it returns text, and it has no write path",
  "modules/ai/ai.module.js": "provides the gateway",
  "modules/ai/ai-status.service.js":
    "reads the provider's name, model and mock flag, and no key",
  "modules/ai/domain/ai-errors.js":
    "the gateway's own error classes and mapping",
  "modules/ai/domain/ai-call-context.js": "the labels a call must carry",
  "modules/ai/domain/read-only-tool.js":
    "defineReadOnlyTool: the only kind of tool the gateway takes, with no write path",
  "modules/ai/providers/mock-scripts.js":
    "the registry Spark's offline script is added to",
  "modules/orders/orders.service.js":
    "the orders reader: lists and reads, and masks money by role",
  "modules/orders/orders.module.js":
    "exports the reader and nothing that writes an order",
  "modules/master-data/master-data.service.js":
    "the item reader: lists and reads, and masks prices by role",
  "modules/master-data/master-data.module.js":
    "exports the item reader and the lookups",
  "audit/audit.service.js":
    "the audit writer, to record a question and an answer",
  "audit/audit.module.js": "wires the audit writer",
  "common/domain-error.js": "the error base classes",
  "common/openapi.js": "documents a route from its zod schema",
  "common/request-id.js": "the request id, for the trace id of an audit row",
  "common/zod-validation.pipe.js": "parses a request with its zod schema",
  "auth/auth-context.js": "the shape of a signed-in user",
  "auth/decorators.js": "marks who may call a route; the guards decide",
  "config/app-config.js": "the typed settings",
  "database/database.js": "the transaction around each of the two writes",
};

/**
 * Prisma is the repository's alone: a service or a domain class that imported
 * it would be a second way to the tables.
 */
const PRISMA_REACH = "generated/prisma/client.js";
const REPOSITORY_FILE = join(
  SPARK_DIRECTORY,
  "spark-conversation.repository.ts",
);

/** Every module specifier a source file imports, statically or with import(). */
function importsOf(source: string): string[] {
  const pattern =
    /(?:^|\s)(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|(?:^|\s)import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  return [...source.matchAll(pattern)].flatMap((match) => {
    const specifier = match[1] ?? match[2] ?? match[3];
    return specifier === undefined ? [] : [specifier];
  });
}

function packageAllowed(name: string): boolean {
  return (
    name === "@nestjs/common" ||
    name === "@nestjs/swagger" ||
    name === "@orderpilot/shared" ||
    name === "zod" ||
    name === "vitest" ||
    name.startsWith("node:")
  );
}

const underSrcOf = (path: string): string =>
  relative(SRC, path).split(sep).join("/");

/** The path under src/ of what a relative import reaches, or null inside the module. */
function reachOf(file: string, specifier: string): string | null {
  const target = resolve(dirname(file), specifier);
  if (target === SPARK_DIRECTORY || target.startsWith(SPARK_DIRECTORY + sep)) {
    return null;
  }
  return underSrcOf(target);
}

/** The imports of `source`, as it sits at `file`, that the module may not have. */
function violationsIn(file: string, source: string): string[] {
  const bad: string[] = [];
  for (const specifier of importsOf(source)) {
    if (!specifier.startsWith(".")) {
      if (!packageAllowed(specifier)) bad.push(specifier);
      continue;
    }
    const reach = reachOf(file, specifier);
    if (reach === null || reach in ALLOWED_OUTSIDE) continue;
    if (reach === PRISMA_REACH && file === REPOSITORY_FILE) continue;
    bad.push(specifier);
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

describe("what the Spark module imports", () => {
  const files = sourceFiles(SPARK_DIRECTORY);

  const reachesOf = (file: string): (string | null)[] =>
    importsOf(readFileSync(file, "utf8"))
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) => reachOf(file, specifier));

  it("reads the files of the module, so the check below is not empty", () => {
    expect(files.length).toBeGreaterThan(8);
    expect(files.some((file) => file.endsWith("spark.service.ts"))).toBe(true);
  });

  it("reaches no service that writes, approves, pays, posts or sends", () => {
    const violations = files.flatMap((file) =>
      violationsIn(file, readFileSync(file, "utf8")).map(
        (specifier) => `${underSrcOf(file)} imports ${specifier}`,
      ),
    );
    expect(violations).toEqual([]);
  });

  it("allows nothing that no file uses: a reach nobody needs is taken off the list", () => {
    const reached = new Set(files.flatMap(reachesOf));
    expect(
      Object.keys(ALLOWED_OUTSIDE).filter((path) => !reached.has(path)),
    ).toEqual([]);
  });

  it("has Prisma in the repository and nowhere else", () => {
    const users = files.filter((file) =>
      reachesOf(file).includes(PRISMA_REACH),
    );
    expect(users).toEqual([REPOSITORY_FILE]);
  });

  it("imports an orders module that exports the reader and not the writer, and a master data module that exports no writer", () => {
    // The second control: even a file that named the writer could not inject it.
    const ordersExports = Reflect.getMetadata(
      "exports",
      OrdersModule,
    ) as unknown[];
    expect(ordersExports).toContain(OrdersService);
    expect(ordersExports).not.toContain(OrdersWriteService);
    const masterExports = Reflect.getMetadata(
      "exports",
      MasterDataModule,
    ) as unknown[];
    expect(masterExports).toContain(MasterDataService);
  });

  describe("the check itself", () => {
    const here = join(SPARK_DIRECTORY, "spark.service.ts");

    it("flags an orders, workflows, approvals, master data, queue or storage service, and a package it has no business with", () => {
      for (const specifier of [
        "../orders/orders-write.service.js",
        "../orders/order-number.allocator.js",
        "../orders/sales-order.repository.js",
        "../workflows/workflows.service.js",
        "../workflows/spr-approval.service.js",
        "../governance/authorisation.service.js",
        "../master-data/stock-lookup.js",
        "../master-data/item-lookup.js",
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
      // The AI SDK is the gateway's: a Spark file that imported it would reach a model around the gateway.
      expect(violationsIn(here, 'import { generateText } from "ai";')).toEqual([
        "ai",
      ]);
    });

    it("refuses the provider, the tracker and the policy: Spark reaches a model through the gateway only", () => {
      for (const specifier of [
        "../ai/domain/llm-provider.js",
        "../ai/ai-usage.tracker.js",
        "../ai/ai-destination.policy.js",
        "../ai/providers/provider-factory.js",
      ]) {
        expect(violationsIn(here, `import { X } from "${specifier}";`)).toEqual(
          [specifier],
        );
      }
    });

    it("refuses the provider port itself: a tool result type comes from the mock's own types", () => {
      expect(
        violationsIn(
          here,
          'import type { AiToolResultPart } from "../ai/domain/llm-provider.js";',
        ),
      ).toEqual(["../ai/domain/llm-provider.js"]);
    });

    it("lets only the repository import Prisma", () => {
      const prisma =
        'import { Prisma } from "../../generated/prisma/client.js";';
      expect(violationsIn(REPOSITORY_FILE, prisma)).toEqual([]);
      expect(violationsIn(here, prisma)).toEqual([
        "../../generated/prisma/client.js",
      ]);
    });

    it("lets the gateway, the audit writer and the module's own files through", () => {
      expect(
        violationsIn(
          here,
          [
            'import { LlmGateway } from "../ai/llm-gateway.js";',
            'import { OrdersService } from "../orders/orders.service.js";',
            'import { MasterDataService } from "../master-data/master-data.service.js";',
            'import { AuditService } from "../../audit/audit.service.js";',
            'import { x } from "./domain/spark-history.js";',
            'import { z } from "zod";',
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });
});
