import { readdir } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import {
  COMMITTED,
  generated,
  readCommitted,
  type Generated,
} from "./testing/generated.js";

let run: Generated;
beforeAll(async () => {
  run = await generated();
});

describe("the committed demo files", () => {
  it("are exactly what the script makes, byte for byte", async () => {
    for (const file of run.files) {
      const committed = await readCommitted(file.name).catch(() => null);
      expect(
        committed?.equals(Buffer.from(file.bytes)) ?? false,
        `${file.name} differs: run pnpm docs:generate and commit the result`,
      ).toBe(true);
    }
  });

  it("have nothing beside them that the script does not make", async () => {
    const names = (await readdir(COMMITTED)).sort();
    expect(names).toEqual(run.files.map((f) => f.name).sort());
    expect(names.filter((n) => n.endsWith(".pdf"))).toHaveLength(12);
    expect(names).toContain("README.md");
  });

  it("list every file in the README, with its order", async () => {
    const readme = (await readCommitted("README.md")).toString("utf8");
    for (const truth of run.truth.values()) {
      expect(readme).toContain(truth.file);
      expect(readme).toContain(truth.orderNo);
    }
    expect(readme).toContain("Synthetic demo data");
    expect(readme).toContain("pnpm docs:generate");
  });
});
