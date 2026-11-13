import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

/** The demo document the preview reviews, and the rasterised pages of its PDF. */
export const DEMO_NAME = "po-boxed-so-0102";
export const DEMO_JSON = `/demo-documents/${DEMO_NAME}.json`;
export const demoPageImage = (page: number) =>
  `/directions/${DEMO_NAME}-p${String(page)}.png`;

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

async function loadDemo(): Promise<DemoDocument> {
  const response = await fetch(DEMO_JSON);
  if (!response.ok) throw new Error(String(response.status));
  return documentSchema.parse(await response.json());
}

/** The demo purchase order's ground truth, fetched from the same origin. */
export function useDemoDocument(enabled: boolean) {
  return useQuery({
    queryKey: ["directions", "demo-document", DEMO_NAME],
    queryFn: loadDemo,
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
