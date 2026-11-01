import type { TFunction } from "i18next";
import { z } from "zod";
import {
  requiredLookup,
  type LookupOption,
  type LookupSearch,
} from "@/components/form";
import { ApiError } from "@/lib/api/errors";

// Synthetic demo data, in the shape of the mock Navision's customers and items.
export const GALLERY_CUSTOMERS: readonly LookupOption[] = [
  { number: "C-0001", name: "Quillon Harbour Traders", detail: "IN" },
  { number: "C-0002", name: "Brindle Coast Imports", detail: "LK" },
  { number: "C-0003", name: "Tamarell Palm Wholesale", detail: "BD" },
  { number: "C-0004", name: "Verrick Bazaar Distribution", detail: "PK" },
  { number: "C-0005", name: "Ostrel Ridge Trading", detail: "AE" },
  { number: "C-0006", name: "Dhanvera Systems Pvt Ltd", detail: "IN" },
  { number: "C-0010", name: "Dunefall General Trading LLC", detail: "AE" },
];

export const GALLERY_ITEMS: readonly LookupOption[] = [
  { number: "I-0001", name: "Norvale Wireless Mouse", detail: "PCS" },
  { number: "I-0002", name: "Norvale Wired Keyboard", detail: "PCS" },
  { number: "I-0026", name: "Kelmora Wireless Mouse", detail: "PCS" },
  { number: "I-0101", name: "Vantora Dome Camera", detail: "PCS" },
  { number: "I-0102", name: "Vantora Bullet Camera", detail: "PCS" },
];

export const PAYMENT_TERMS = [
  "30 DAYS",
  "PREPAID",
  "LC AT SIGHT",
  "50% ADVANCE",
] as const;

export const ANSWERS = [
  "saves",
  "fields",
  "noField",
  "conflict",
  "forbidden",
  "failure",
  "searchFails",
] as const;
export type FakeAnswer = (typeof ANSWERS)[number];

const WHOLE = /^\d+$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/** The gallery's own schema. A real form's schema lives in `packages/shared`. */
export function makeOrderSchema(t: TFunction<"gallery">) {
  const line = z.object({
    item: requiredLookup(t("form.errors.item")),
    quantity: z
      .string()
      .refine((value) => WHOLE.test(value) && Number(value) > 0, {
        message: t("form.errors.quantity"),
      }),
  });
  return z
    .object({
      customer: requiredLookup(t("form.errors.customer")),
      customerPo: z.string().trim().min(1, t("form.errors.customerPo")),
      orderDate: z.iso.date(t("form.errors.orderDate")),
      shipBy: z.union([z.literal(""), z.iso.date(t("form.errors.shipBy"))]),
      paymentTerms: z.string().min(1, t("form.errors.paymentTerms")),
      currency: z.string(),
      postingDate: z.string(),
      freight: z.string().regex(AMOUNT, t("form.errors.freight")),
      creditLimit: z.union([
        z.literal(""),
        z.string().regex(AMOUNT, t("form.errors.freight")),
      ]),
      partialShipment: z.boolean(),
      remarks: z.string().max(500, t("form.errors.remarks")),
      lines: z.array(line),
    })
    .superRefine((order, context) => {
      if (order.shipBy !== "" && order.shipBy < order.orderDate) {
        context.addIssue({
          code: "custom",
          path: ["shipBy"],
          message: t("form.errors.shipByBefore"),
        });
      }
    });
}

export type OrderSchema = ReturnType<typeof makeOrderSchema>;
export type OrderInput = z.input<OrderSchema>;
export type OrderOutput = z.output<OrderSchema>;

/** Today in Singapore, as YYYY-MM-DD. */
function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

export function orderDefaults(): OrderInput {
  return {
    customer: null,
    customerPo: "",
    orderDate: today(),
    shipBy: "",
    paymentTerms: "",
    currency: "USD",
    postingDate: "",
    freight: "",
    creditLimit: "",
    partialShipment: false,
    remarks: "",
    lines: [
      { item: null, quantity: "" },
      { item: null, quantity: "" },
    ],
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** A search over synthetic records, slow enough to show its loading state. */
export function fakeSearch(
  records: readonly LookupOption[],
  fails: () => boolean,
  delayMs = 350,
): LookupSearch {
  return async (query, signal) => {
    await wait(delayMs, signal);
    if (fails()) throw new Error("search failed");
    const needle = query.trim().toLowerCase();
    return records.filter(
      (record) =>
        record.number.toLowerCase().includes(needle) ||
        record.name.toLowerCase().includes(needle),
    );
  };
}

const TRACE = "trace-demo-form-0001";

/** The answer a real API would give, without one. */
export async function fakeSave(
  answer: FakeAnswer,
  values: OrderOutput,
  t: TFunction<"gallery">,
  delayMs = 500,
): Promise<void> {
  await wait(delayMs);
  const item = values.lines[1]?.item.number ?? "";
  if (answer === "fields") {
    throw new ApiError(
      "VALIDATION_FAILED",
      "The request is not valid.",
      400,
      TRACE,
      [
        { path: "lines.1.quantity", message: t("form.server.stock", { item }) },
        {
          path: "customerPo",
          message: t("form.server.poUsed", { po: values.customerPo }),
        },
      ],
    );
  }
  if (answer === "noField") {
    throw new ApiError(
      "VALIDATION_FAILED",
      "The request is not valid.",
      400,
      TRACE,
      [{ path: "warehouseCode", message: t("form.server.warehouse") }],
    );
  }
  if (answer === "conflict") {
    throw new ApiError("CONFLICT", t("form.server.conflict"), 409, TRACE);
  }
  if (answer === "forbidden") {
    throw new ApiError(
      "FORBIDDEN",
      "You are not allowed to do this.",
      403,
      TRACE,
    );
  }
  if (answer === "failure") {
    throw new ApiError("INTERNAL_ERROR", "Something went wrong.", 500, TRACE);
  }
}
