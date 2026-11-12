import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { DEMO_FILES, DEMO_REFERENCE_DATE, renderEntry } from "./demo.js";
import { DEMO_LABEL } from "./model.js";
import { twelvePlan } from "./plan/twelve.js";
import { definitionOf } from "./registry.js";
import type { GroundTruth } from "./truth.js";

export interface GeneratedFile {
  /** The path inside the demo folder. */
  name: string;
  bytes: Uint8Array;
}

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

function readme(truths: readonly GroundTruth[]): string {
  const rows = truths.map((t) => {
    const look = t.readable === "image" ? `${t.layout} (scan)` : t.layout;
    const stem = t.file.replace(/\.pdf$/, "");
    return `| \`${t.file}\` | ${definitionOf(t.kind).name} ${t.documentNumber} | ${t.orderNo ?? "none"} | ${look} | ${String(t.uncertainFieldCount)} | ${t.purpose} (\`${stem}.json\`) |`;
  });
  return `# Demo documents

${DEMO_LABEL}. Twelve PDFs of fictional companies, with USD prices and demo bank details that cannot be paid into. Nothing here is a real document, and none comes from a client.

Each file is tied to an order in the synthetic data (\`${DEMO_REFERENCE_DATE}\` is the reference date they are made on) and has a JSON file beside it with the ground truth: every field's value, its page and box (fractions of the page, from the top-left corner), and the confidence Mock AI reports. A field is uncertain when its confidence is under the shared threshold of ${String(truths[0]?.confidenceThreshold ?? 0)}.

| File | Document | Order | Layout | Uncertain fields | What it is for |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Making them again

These files are generated. Do not edit them by hand.

\`\`\`
pnpm docs:generate
\`\`\`

The dates on the files, and the number of a proforma invoice (which carries its date), are those of \`${DEMO_REFERENCE_DATE}\`. The dates in the app move with today, so after that day the three PIs show another number in the app than the file prints. Every other number agrees on any day.

A test regenerates all twelve and compares them with these byte for byte, so the script and the files cannot drift apart. If a change to the synthetic data or to a layout changes a file, that test fails until the files are regenerated and committed.
`;
}

/** Every file of the demo folder: the PDFs, their ground truth, and the README. */
export async function generateDemoFiles(): Promise<GeneratedFile[]> {
  const dataset = createSyntheticDataset({
    referenceDate: DEMO_REFERENCE_DATE,
  });
  const files: GeneratedFile[] = [];
  const truths: GroundTruth[] = [];
  const plan = twelvePlan(dataset, DEMO_FILES);
  for (const entry of plan) {
    const { pdf, truth } = await renderEntry(entry, dataset, plan);
    truths.push(truth);
    files.push(
      { name: `${entry.stem}.pdf`, bytes: pdf },
      {
        name: `${entry.stem}.json`,
        bytes: text(`${JSON.stringify(truth, null, 2)}\n`),
      },
    );
  }
  files.push({ name: "README.md", bytes: text(readme(truths)) });
  return files;
}
