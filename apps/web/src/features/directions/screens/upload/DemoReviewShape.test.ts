import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/locales/en/directions-intake.json";
import { DEMO_SURE_LINES, DEMO_UNSURE_LINES } from "./DemoFieldsSkeleton";
import { DEMO_SHAPE } from "./DemoReviewSkeleton";

// The wait is as tall as the review only while its numbers are the demo
// document's own, so they are read from the ground truth here.

interface Truth {
  documentNumber: string;
  fields: { key: string; text: string; uncertain: boolean }[];
}

const truth = JSON.parse(
  readFileSync(
    join(process.cwd(), "public", "demo-documents", "po-boxed-so-0102.json"),
    "utf8",
  ),
) as Truth;

const lines = (text: string) => text.split("\n").length;

describe("the shape of the wait for the demo document", () => {
  it("counts the fields Spark read and the ones it was unsure of as the ground truth does", () => {
    expect(DEMO_SHAPE.fields).toBe(truth.fields.length);
    expect(DEMO_SHAPE.unsure).toBe(
      truth.fields.filter((field) => field.uncertain).length,
    );
  });

  it("gives each row the number of lines its value takes, the unsure ones first", () => {
    expect([...DEMO_UNSURE_LINES]).toEqual(
      truth.fields.filter((f) => f.uncertain).map((f) => lines(f.text)),
    );
    expect([...DEMO_SURE_LINES]).toEqual(
      truth.fields.filter((f) => !f.uncertain).map((f) => lines(f.text)),
    );
  });

  it("writes the line under the title as the review does: the number, then the customer", () => {
    const customer = truth.fields.find((field) => field.key === "customerName");
    expect(en.review.waitLine).toBe(
      `${truth.documentNumber}, ${customer?.text ?? ""}`,
    );
  });
});
