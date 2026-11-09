import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DEMO_FILES, type GroundTruth } from "../demo.js";
import { generateDemoFiles, type GeneratedFile } from "../files.js";

export interface Generated {
  files: GeneratedFile[];
  pdf: Map<string, Uint8Array>;
  truth: Map<string, GroundTruth>;
}

let cached: Promise<Generated> | undefined;

/** The twelve demo files, made once for the whole test file. */
export function generated(): Promise<Generated> {
  cached ??= generateDemoFiles().then((files) => {
    const pdf = new Map<string, Uint8Array>();
    const truth = new Map<string, GroundTruth>();
    for (const file of files) {
      const stem = file.name.replace(/\.[a-z]+$/, "");
      if (file.name.endsWith(".pdf")) pdf.set(stem, file.bytes);
      if (file.name.endsWith(".json")) {
        truth.set(
          stem,
          JSON.parse(Buffer.from(file.bytes).toString("utf8")) as GroundTruth,
        );
      }
    }
    return { files, pdf, truth };
  });
  return cached;
}

/** The stem of the one scanned demo file, whichever order the data picks for it. */
export function scanStem(): string {
  const scan = DEMO_FILES.find((f) => f.scanned);
  if (!scan) throw new Error("No scanned demo file");
  return scan.stem;
}

/** The first demo PO, the boxed two-page form, and its order. */
export function boxedPo() {
  const file = DEMO_FILES.find(
    (f) => f.kind === "CUSTOMER_PO" && f.stem.startsWith("po-boxed-"),
  );
  if (!file) throw new Error("No boxed demo PO");
  return file;
}

/** The folder the web app serves the committed files from. */
export const COMMITTED = fileURLToPath(
  new URL("../../../../apps/web/public/demo-documents/", import.meta.url),
);

export const readCommitted = (name: string): Promise<Buffer> =>
  readFile(`${COMMITTED}${name}`);
