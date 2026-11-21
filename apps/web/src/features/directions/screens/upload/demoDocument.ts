import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

/**
 * The preview documents a file name can open. Spark here is a scripted
 * preview, so a file is matched by its name (without the extension, any case)
 * to a document whose ground truth and page images are already made. A file
 * with any other name has no sample: it is not read, and the screen says so.
 * The page images sit next to the JSON by name.
 */
const PREVIEW_DOCUMENTS = {
  "po-boxed-so-0102": "/demo-documents/po-boxed-so-0102.json",
  "po-4471-26": "/directions/po-4471-26.json",
} as const satisfies Record<string, string>;

export type PreviewName = keyof typeof PREVIEW_DOCUMENTS;
export const DEMO_NAME: PreviewName = "po-boxed-so-0102";

/**
 * How each sample is named at the file list, before it is read: the number
 * printed on the document (a test keeps these equal to the ground truth).
 */
export const SAMPLE_SHOWN: Record<PreviewName, string> = {
  "po-boxed-so-0102": "PO-IN-4807",
  "po-4471-26": "PO 4471-26",
};

function isPreviewName(name: string): name is PreviewName {
  return Object.hasOwn(PREVIEW_DOCUMENTS, name);
}

/** The sample a file name opens, or null: only a known name has one. */
export function sampleFor(fileName: string): PreviewName | null {
  const stem = fileName.replace(/\.[^.]*$/, "").toLowerCase();
  return isPreviewName(stem) ? stem : null;
}

/** The rasterised page of a preview document, by the name its PDF file carries. */
export const demoPageImage = (document: { file: string }, page: number) =>
  `/directions/${document.file.replace(/\.pdf$/, "")}-p${String(page)}.png`;

// Only what the review reads. The file is the ground truth the document
// generator writes: the page, the box and the confidence Mock AI reports for
// every field. It is parsed before use, like anything that crosses a boundary.
const fieldSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  group: z.enum(["header", "lines", "totals"]),
  lineIndex: z.number().nullable(),
  text: z.string(),
  page: z.number().int().min(1),
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  confidence: z.number().min(0).max(1),
  uncertain: z.boolean(),
});

const documentSchema = z.object({
  label: z.string(),
  file: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  orderNo: z.string(),
  pageCount: z.number().int().min(1),
  confidenceThreshold: z.number(),
  fields: z.array(fieldSchema).min(1),
});

export type DemoField = z.infer<typeof fieldSchema>;
export type DemoDocument = z.infer<typeof documentSchema>;

async function loadDemo(name: PreviewName): Promise<DemoDocument> {
  const response = await fetch(PREVIEW_DOCUMENTS[name]);
  if (!response.ok) throw new Error(String(response.status));
  return documentSchema.parse(await response.json());
}

/** A preview purchase order's ground truth, fetched from the same origin. */
export function useDemoDocument(name: PreviewName, enabled: boolean) {
  return useQuery({
    queryKey: ["directions", "demo-document", name],
    queryFn: () => loadDemo(name),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
