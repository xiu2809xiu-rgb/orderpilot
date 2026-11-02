import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { GroundTruth } from "../demo.js";
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

/** The folder the web app serves the committed files from. */
export const COMMITTED = fileURLToPath(
  new URL("../../../../apps/web/public/demo-documents/", import.meta.url),
);

export const readCommitted = (name: string): Promise<Buffer> =>
  readFile(`${COMMITTED}${name}`);
