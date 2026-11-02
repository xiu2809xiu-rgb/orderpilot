import { describe, expect, it } from "vitest";
import { fitsShape, mergeDraft, omitPaths } from "./draftValues";

const customer = { number: "C-0001", name: "Quillon Harbour Traders" };
const item = { number: "I-0101", name: "Cable" };

describe("fitsShape", () => {
  it("accepts a filled lookup that was cleared", () => {
    expect(fitsShape({ customer }, { customer: null })).toBe(true);
  });

  it("accepts a lookup that was blank and is now filled", () => {
    expect(fitsShape({ customer: null }, { customer })).toBe(true);
  });

  it("accepts a line added with no item yet beside a filled first line", () => {
    const template = { lines: [{ item, quantity: "1" }] };
    const value = {
      lines: [
        { item, quantity: "1" },
        { item: null, quantity: "" },
      ],
    };
    expect(fitsShape(template, value)).toBe(true);
  });

  it("accepts a field that partial defaults do not name", () => {
    expect(fitsShape({ po: "" }, { po: "x", notes: "typed" })).toBe(true);
  });

  it("refuses a value of another type", () => {
    expect(fitsShape({ po: "" }, { po: 7 })).toBe(false);
    expect(fitsShape({ lines: [] }, { lines: "x" })).toBe(false);
    expect(fitsShape({ customer }, { customer: "C-1" })).toBe(false);
  });

  it("refuses a record that names nothing the form has", () => {
    expect(fitsShape({ po: "" }, { gone: "field" })).toBe(false);
  });

  it("never lets a prototype key through", () => {
    const planted: unknown = JSON.parse('{"po":"x","__proto__":{"a":1}}');
    expect(fitsShape({ po: "" }, planted)).toBe(false);
  });
});

describe("mergeDraft", () => {
  const base = {
    lines: [
      { id: "L1", item: "A", price: "10" },
      { id: "L2", item: "B", price: "20" },
    ],
  };

  it("gives a row back its left-out field from the row with the same id", () => {
    const draft = omitPaths({ lines: [{ id: "L2", item: "B", price: "20" }] }, [
      "lines.*.price",
    ]);
    expect(mergeDraft(base, draft)).toEqual({
      lines: [{ id: "L2", item: "B", price: "20" }],
    });
  });

  it("never gives a row the field of another row by position", () => {
    const draft = omitPaths({ lines: [{ item: "B", price: "20" }] }, [
      "lines.*.price",
    ]);
    expect(mergeDraft(base, draft)).toEqual({ lines: [{ item: "B" }] });
  });

  it("leaves the left-out field of a new row empty", () => {
    const draft = [{ id: "NEW", item: "C" }];
    expect(mergeDraft(base, { lines: draft })).toEqual({
      lines: [{ id: "NEW", item: "C" }],
    });
  });

  it("keeps a left-out top-level field from the form", () => {
    expect(mergeDraft({ po: "", limit: "500" }, { po: "x" })).toEqual({
      po: "x",
      limit: "500",
    });
  });
});
