import type { TFunction } from "i18next";
import { z } from "zod";
import type { StatusFamily } from "@/components/common";
import { requiredLookup } from "@/components/form";
import { ApiError } from "@/lib/api/errors";
import { emptyLine } from "@/components/lines-grid";
import { makeLinesSchema, type LinesOutput } from "./linesDemo";

export const DOC_STATUSES = ["draft", "waiting", "approved", "void"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_FAMILY: Record<DocStatus, StatusFamily> = {
  draft: "draft",
  waiting: "waiting",
  approved: "ready",
  void: "blocked",
};

/** Numbers run on from the one the demo starts with, as a real series would. */
export function documentNumber(sequence: number): string {
  return `SO-20261106-${String(sequence).padStart(4, "0")}`;
}
export const DOC_NUMBER = documentNumber(1);

/** A document with nothing in it yet: what Save and new opens. */
export function blankDocument(orderDate: string): DocumentInput {
  return {
    customer: null,
    customerPo: "",
    orderDate,
    paymentTerms: "",
    lines: [emptyLine()],
  };
}

/** The gallery's own schema: a header and the lines grid's lines. */
export function makeDocumentSchema(t: TFunction<"gallery">) {
  return z.object({
    customer: requiredLookup(t("document.errors.customer")),
    customerPo: z.string().trim().min(1, t("document.errors.customerPo")),
    orderDate: z.iso.date(t("document.errors.orderDate")),
    paymentTerms: z.string().min(1, t("document.errors.paymentTerms")),
    lines: makeLinesSchema(t).shape.lines,
  });
}
export type DocumentSchema = ReturnType<typeof makeDocumentSchema>;
export type DocumentInput = z.input<DocumentSchema>;
export type DocumentOutput = z.output<DocumentSchema>;

/** What a real API would answer. The same PO number twice is refused, field by field. */
export async function fakeDocumentSave(
  values: DocumentOutput,
  t: TFunction<"gallery">,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (values.customerPo.toUpperCase() === "CPO-USED") {
    throw new ApiError(
      "VALIDATION_FAILED",
      "The request is not valid.",
      400,
      "trace-demo-document-0001",
      [
        {
          path: "customerPo",
          message: t("document.server.poUsed", { po: values.customerPo }),
        },
      ],
    );
  }
}

export type { LinesOutput };
