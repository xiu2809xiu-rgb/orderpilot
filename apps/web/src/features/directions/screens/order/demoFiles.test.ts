import { describe, expect, it } from "vitest";
import { DEMO_FILE_NAMES, demoFileFor } from "./demoFiles";

// The ground truth beside each PDF says which order and which kind of document
// the file is for, so the table in demoFiles.ts is checked against it, not
// against itself. A file added to the folder without a row in the table fails
// the last test.
const truth = import.meta.glob<{
  default: { orderNo: string; documentType: string; file: string };
}>("../../../../../public/demo-documents/*.json", { eager: true });

const entries = Object.values(truth).map((module) => module.default);

describe("the demo files", () => {
  it("finds the twelve generated documents", () => {
    expect(entries).toHaveLength(12);
  });

  it.each(entries)(
    "opens $file for $documentType of $orderNo",
    ({ orderNo, documentType, file }) => {
      expect(demoFileFor(orderNo, documentType as never)).toBe(
        `/demo-documents/${file}`,
      );
    },
  );

  it("has a row for every file and no row for a file that is not there", () => {
    expect([...DEMO_FILE_NAMES].sort()).toEqual(
      entries.map((entry) => entry.file).sort(),
    );
  });

  it("has no file for a document the demo set does not hold", () => {
    expect(demoFileFor("SO-0001", "CUSTOMER_PO")).toBeNull();
    expect(demoFileFor("SO-0102", "PACKING_LIST")).toBeNull();
    expect(demoFileFor("SO-9999", "SALES_INVOICE")).toBeNull();
  });
});
