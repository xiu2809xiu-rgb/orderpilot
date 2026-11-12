import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_FILES } from "./demo.js";
import type { GroundTruth } from "./truth.js";
import { generated, type Generated } from "./testing/generated.js";

let run: Generated;
beforeAll(async () => {
  run = await generated();
});

const truthOf = (stem: string): GroundTruth => {
  const truth = run.truth.get(stem);
  if (!truth) throw new Error(`No ground truth for ${stem}`);
  return truth;
};

// The keys of version 1, in their order. They are the contract of the demo
// folder and never move: a new key is appended after them.
const VERSION_1_KEYS = [
  "label",
  "file",
  "documentType",
  "documentNumber",
  "layout",
  "readable",
  "orderNo",
  "customerNo",
  "purpose",
  "pageCount",
  "page",
  "confidenceThreshold",
  "uncertainFieldCount",
  "mismatch",
  "fields",
];
const VERSION_2_KEYS = [
  "schemaVersion",
  "stem",
  "kind",
  "stage",
  "issuer",
  "issuerName",
  "direction",
  "scan",
  "pages",
  "links",
  "lines",
  "planted",
  "counts",
];

describe("the ground truth of the twelve", () => {
  it("keeps every key of version 1 in its place and appends the new ones", () => {
    for (const truth of run.truth.values()) {
      expect(Object.keys(truth)).toEqual([
        ...VERSION_1_KEYS,
        ...VERSION_2_KEYS,
      ]);
      expect(truth.schemaVersion).toBe(2);
      expect(truth.stem + ".pdf").toBe(truth.file);
      expect(truth.confidenceThreshold).toBe(CONFIDENCE_HIGH);
    }
  });

  it("puts `planted` last on every field, and names no severity", () => {
    for (const truth of run.truth.values()) {
      for (const field of truth.fields) {
        expect(Object.keys(field).at(-1)).toBe("planted");
      }
      expect(JSON.stringify(truth)).not.toMatch(/severity|affects/);
    }
  });

  it("plants one mistake, on the packing list that packs fewer, and none elsewhere", () => {
    const withOne = [...run.truth.values()].filter((t) => t.planted.length > 0);
    expect(withOne.map((t) => t.stem)).toEqual(["pl-so-0041-mismatch"]);
    for (const truth of run.truth.values()) {
      expect(truth.counts.plantedCount).toBe(truth.planted.length);
      const flagged = truth.fields.filter((f) => f.planted).map((f) => f.id);
      const listed = truth.planted.flatMap((p) =>
        p.values.map((v) => v.fieldId),
      );
      expect(flagged.sort()).toEqual(listed.sort());
    }
  });

  it("derives `mismatch` from the quantity record, so the two cannot disagree", () => {
    const truth = truthOf("pl-so-0041-mismatch");
    const [record] = truth.planted;
    if (!record) throw new Error("no record");
    const first = record.values[0];
    expect(record.kind).toBe("quantity");
    expect(record.primaryFieldId).toBe("lines.quantity[0]");
    expect(first?.fieldId).toBe(record.primaryFieldId);
    expect(truth.mismatch).toEqual({
      lineIndex: 0,
      partNumber: truth.lines[0]?.values.partNumber,
      ordered: first?.expected,
      packed: first?.printed,
    });
    for (const other of run.truth.values()) {
      if (other.stem !== truth.stem) expect(other.mismatch).toBeNull();
    }
  });

  it("lists a dependant only where it differs, and names where the right value comes from", () => {
    const [record] = truthOf("pl-so-0041-mismatch").planted;
    if (!record) throw new Error("no record");
    for (const value of record.values) {
      expect(value.printed, value.fieldId).not.toBe(value.expected);
    }
    const [primary, ...dependants] = record.values;
    expect(primary?.expectedFrom).toEqual({
      source: "document",
      stem: "po-table-so-0041",
      fieldId: "lines.quantity[0]",
    });
    expect(dependants.length).toBeGreaterThan(0);
    for (const d of dependants) {
      expect(d.expectedFrom).toEqual({
        source: "derived",
        fieldId: "lines.quantity[0]",
      });
    }
    // The right quantity really is the PO's.
    const po = truthOf("po-table-so-0041");
    expect(po.fields.find((f) => f.id === "lines.quantity[0]")?.value).toBe(
      primary?.expected,
    );
    expect(record.twin).toBe("pl-so-0026");
    expect(truthOf("pl-so-0041-mismatch").links.related).toEqual([
      { stem: "pl-so-0026", relation: "twin-of" },
      { stem: "po-table-so-0041", relation: "expected-from" },
    ]);
  });

  it("counts what it holds", () => {
    for (const truth of run.truth.values()) {
      expect(truth.counts).toEqual({
        fieldCount: truth.fields.length,
        uncertainFieldCount: truth.fields.filter((f) => f.uncertain).length,
        plantedCount: truth.planted.length,
        lineCount: truth.lines.length,
      });
      expect(truth.uncertainFieldCount).toBe(truth.counts.uncertainFieldCount);
      expect(truth.pages).toHaveLength(truth.pageCount);
    }
  });

  it("holds each line once, with the page its cells are on", () => {
    for (const truth of run.truth.values()) {
      const indexes = truth.fields
        .filter((f) => f.lineIndex !== null)
        .map((f) => f.lineIndex);
      expect(truth.lines.map((l) => l.lineIndex)).toEqual(
        [...new Set(indexes)].sort(),
      );
      for (const line of truth.lines) {
        const cells = truth.fields.filter(
          (f) => f.lineIndex === line.lineIndex,
        );
        expect(line.page).toBe(Math.min(...cells.map((f) => f.page)));
        for (const cell of cells) {
          expect(line.values[cell.key.replace("lines.", "")]).toBe(cell.value);
        }
      }
    }
  });

  it("says what each document is tied to, and who issued it", () => {
    for (const truth of run.truth.values()) {
      expect(truth.links.poNumber).toMatch(/^PO-/);
      expect(truth.links.vendorNo).toBeNull();
      expect(truth.links.bundle).toBeNull();
      expect(truth.stage).toBeNull();
      expect(truth.documentType).toBe(truth.kind);
      expect(truth.issuerName.length).toBeGreaterThan(0);
    }
    expect(truthOf("po-boxed-so-0102")).toMatchObject({
      issuer: "customer",
      direction: "inbound",
    });
    expect(truthOf("pi-so-0075")).toMatchObject({
      issuer: "spectra",
      direction: "outbound",
    });
  });

  it("describes the scan, and only the scan", () => {
    const scanned = DEMO_FILES.filter((f) => f.scanned);
    expect(scanned).toHaveLength(1);
    for (const truth of run.truth.values()) {
      if (scanned.some((f) => f.stem === truth.stem)) {
        expect(truth.scan).toEqual({ dpi: 100, pages: 1, tiltDegrees: [0.9] });
        expect(truth.readable).toBe("image");
      } else {
        expect(truth.scan).toBeNull();
      }
    }
  });
});
