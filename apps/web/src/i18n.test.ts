import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import i18n from "./i18n";
import { allFeatures } from "./features/registry";

const src = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}

// Props whose value a person reads or hears.
const TEXT_PROPS = new Set([
  "title",
  "placeholder",
  "alt",
  "aria-label",
  "label",
]);

function hardCodedTextIn(code: string, name: string): string[] {
  const source = ts.createSourceFile(
    name,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) && /[A-Za-z]{2}/.test(node.text)) {
      found.push(node.text.trim());
    }
    if (
      ts.isJsxAttribute(node) &&
      TEXT_PROPS.has(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      found.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

function hardCodedText(file: string): string[] {
  return hardCodedTextIn(readFileSync(file, "utf8"), file);
}

describe("no hard-coded strings", () => {
  // components/ui is shadcn's vendored source; its text comes in as props.
  const files = sourceFiles(src).filter(
    (file) => !file.includes(`${path.sep}components${path.sep}ui${path.sep}`),
  );

  it("finds the app's source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [path.relative(src, file), file]))(
    "%s has no literal text in its JSX",
    (_name, file) => {
      expect(hardCodedText(file)).toEqual([]);
    },
  );

  it("would catch a literal (the check itself works)", () => {
    const code = `export const A = () => <button title="Save">Save changes</button>;`;
    expect(hardCodedTextIn(code, "bad.tsx")).toEqual(["Save", "Save changes"]);
  });
});

describe("feature namespaces", () => {
  it.each(allFeatures.map((feature) => [feature.namespace]))(
    "%s loads lazily and has a title, a description and its menu names",
    async (namespace) => {
      await i18n.loadNamespaces(namespace);
      expect(i18n.t("title", { ns: namespace })).not.toBe("title");
      expect(i18n.t("description", { ns: namespace })).not.toBe("description");
      const feature = allFeatures.find((f) => f.namespace === namespace);
      for (const entry of feature?.menu ?? []) {
        expect(i18n.t(entry.label), entry.id).not.toBe(entry.label);
      }
    },
  );

  it("keeps talk of the future in planned.json alone", () => {
    const dir = path.join(src, "locales", "en");
    const files = readdirSync(dir).filter(
      (file) => file.endsWith(".json") && file !== "planned.json",
    );
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).not.toMatch(
        /\bPlanned\b|coming soon|No count yet|Counts appear|\barrives\b|Phase 2/i,
      );
    }
  });

  it("gives every planned screen its developer-only list", async () => {
    await i18n.loadNamespaces("planned");
    for (const feature of allFeatures.filter((f) => f.planned)) {
      const lists = i18n.t(`lists.${feature.id}`, {
        ns: "planned",
        returnObjects: true,
      });
      expect(Array.isArray(lists) && lists.length > 0, feature.id).toBe(true);
    }
  });

  it("gives every home tile a label", async () => {
    await i18n.loadNamespaces("home");
    for (const feature of allFeatures) {
      for (const cue of feature.cues) {
        const key = `tiles.${cue.id}`;
        expect(i18n.t(key, { ns: "home" }), `${feature.id} ${key}`).not.toBe(
          key,
        );
      }
    }
  });
});
