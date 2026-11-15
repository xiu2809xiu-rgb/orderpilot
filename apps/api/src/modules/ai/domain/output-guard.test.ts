import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OutputGuard } from "./output-guard.js";

const orderSchema = z.object({
  customerNo: z.string().min(1),
  quantity: z.int().min(1),
  status: z.enum(["open", "closed"]),
  lines: z.array(z.object({ sku: z.string() })).default([]),
});

const guard = new OutputGuard(10_000);

const valid = { customerNo: "C-10010", quantity: 5, status: "open" };

describe("the output guard", () => {
  it("parses JSON text into the schema's type", () => {
    const result = guard.check(JSON.stringify(valid), orderSchema);
    expect(result).toEqual({ ok: true, value: { ...valid, lines: [] } });
  });

  it("accepts the one habit of a code fence around the JSON", () => {
    const fenced = `\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``;
    expect(guard.check(fenced, orderSchema).ok).toBe(true);
    expect(
      guard.check(`\`\`\`\n${JSON.stringify(valid)}\n\`\`\``, orderSchema).ok,
    ).toBe(true);
    expect(
      guard.check(`\uFEFF  ${JSON.stringify(valid)}  \n`, orderSchema).ok,
    ).toBe(true);
  });

  it("drops keys the schema does not name, at every depth", () => {
    const result = guard.check(
      JSON.stringify({
        ...valid,
        approve: true,
        action: "pay",
        lines: [{ sku: "SKU-1", discount: "100%" }],
      }),
      orderSchema,
    );
    expect(result).toEqual({
      ok: true,
      value: { ...valid, lines: [{ sku: "SKU-1" }] },
    });
    expect(JSON.stringify(result)).not.toContain("approve");
    expect(JSON.stringify(result)).not.toContain("discount");
  });

  it("does not let a __proto__ key reach the value", () => {
    const text = `{"customerNo":"C-1","quantity":1,"status":"open","__proto__":{"admin":true}}`;
    const result = guard.check(text, orderSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype);
      expect((result.value as Record<string, unknown>).admin).toBeUndefined();
    }
  });
});

describe("an answer that is refused", () => {
  it("is refused when it is over the size bound, before any parsing", () => {
    const small = new OutputGuard(20);
    const result = small.check(JSON.stringify(valid), orderSchema);
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
    expect(result.ok ? "" : result.problem).toContain("20 characters");
  });

  it("allows an answer exactly at the bound", () => {
    const text = JSON.stringify(valid);
    expect(new OutputGuard(text.length).check(text, orderSchema).ok).toBe(true);
    expect(new OutputGuard(text.length - 1).check(text, orderSchema).ok).toBe(
      false,
    );
  });

  it.each(["", "Sure! Here is the order.", "{not json", "[1, 2", "undefined"])(
    "is refused as not JSON: %j",
    (text) => {
      expect(guard.check(text, orderSchema)).toMatchObject({
        ok: false,
        reason: "not-json",
      });
    },
  );

  it("is refused when text surrounds the JSON", () => {
    expect(
      guard.check(`Here you go: ${JSON.stringify(valid)}`, orderSchema),
    ).toMatchObject({ ok: false, reason: "not-json" });
  });

  it("is refused when the JSON has the wrong shape, naming the fields", () => {
    const result = guard.check(
      JSON.stringify({ customerNo: "", quantity: "five", status: "paid" }),
      orderSchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("wrong-shape");
      expect(result.problem).toContain("customerNo: too small or too short");
      expect(result.problem).toContain("quantity: expected number");
      expect(result.problem).toContain("status: not one of the allowed values");
    }
  });

  it("is refused for a JSON value of the wrong kind altogether", () => {
    const result = guard.check("[1,2,3]", orderSchema);
    expect(result).toMatchObject({ ok: false, reason: "wrong-shape" });
    expect(result.ok ? "" : result.problem).toContain("(answer)");
  });
});

describe("the problem text fed back on a retry", () => {
  it("never echoes the document: no value from the answer appears in it", () => {
    const secret = "ACCOUNT-0000-SECRET-DOC-TEXT";
    const answer = JSON.stringify({
      customerNo: secret,
      quantity: secret,
      status: secret,
      [secret]: secret,
    });
    const strict = z.strictObject({
      customerNo: z.string().max(3),
      quantity: z.int(),
      status: z.enum(["open"]),
    });
    const result = guard.check(answer, strict);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).not.toContain(secret);
      expect(result.problem).toContain("has a field that is not allowed");
    }
  });

  it("does not echo a key the model chose, for a record", () => {
    const secret = "KEY-FROM-THE-DOCUMENT";
    const records = z.object({ byName: z.record(z.string(), z.int()) });
    const result = guard.check(
      JSON.stringify({ byName: { [secret]: "x" } }),
      records,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).not.toContain(secret);
  });

  it("does not echo the text of an answer that is not JSON", () => {
    const secret = "SECRET-PROSE-FROM-A-DOCUMENT";
    const result = guard.check(`The document says ${secret}`, orderSchema);
    expect(result.ok ? "" : result.problem).not.toContain(secret);
  });

  it("does not echo what a feature's own check says, because it uses its own words", () => {
    const secret = "SECRET-IN-A-CUSTOM-CHECK";
    const schema = z.object({
      note: z.string().refine(() => false, { message: secret }),
    });
    const result = guard.check(JSON.stringify({ note: "x" }), schema);
    expect(result.ok ? "" : result.problem).not.toContain(secret);
  });

  it("stays short: five issues at most, then a count", () => {
    const wide = z.object(
      Object.fromEntries(
        Array.from({ length: 9 }, (_, index) => [
          `field${String(index)}`,
          z.string(),
        ]),
      ),
    );
    const result = guard.check("{}", wide);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("and 4 more");
      expect(result.problem.length).toBeLessThan(500);
    }
  });

  it("names array positions", () => {
    const result = guard.check(
      JSON.stringify({ ...valid, lines: [{ sku: "A" }, { sku: 2 }] }),
      orderSchema,
    );
    expect(result.ok ? "" : result.problem).toContain("lines[1].sku");
  });
});

describe("the size bound itself", () => {
  it.each([0, -1, 1.5, Number.NaN])(
    "must be a positive integer: %s",
    (bound) => {
      expect(() => new OutputGuard(bound)).toThrow(RangeError);
    },
  );
});
