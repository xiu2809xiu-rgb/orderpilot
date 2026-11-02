import type { TFunction } from "i18next";
import { z } from "zod";
import { requiredLookup } from "@/components/form";
import {
  emptyLine,
  type ItemOption,
  type ItemSearch,
  type LineValue,
  type ServerTotals,
} from "@/components/lines-grid";
import { ApiError } from "@/lib/api/errors";
import { lineAmount, sumDecimal } from "@orderpilot/shared";

// Synthetic demo data, in the shape of the mock Navision's items: its number,
// its part number, its stock as the API would report it, and its selling price.
export const GALLERY_STOCK: readonly ItemOption[] = [
  stock("I-0001", "Norvale Wireless Mouse", "NV-WM-100", "40", "18.40"),
  stock("I-0002", "Norvale Wired Keyboard", "NV-WK-200", "8", "24.90"),
  stock("I-0026", "Kelmora Wireless Mouse", "KL-WM-110", "120", "16.75"),
  stock("I-0101", "Vantora Dome Camera", "VT-DC-300", "2", "19.99"),
  stock("I-0102", "Vantora Bullet Camera", "VT-BC-310", "15", "21.50"),
  stock("I-0140", "Kelmora 24-port Switch", "KL-SW-24", "0", "212.00"),
];

function stock(
  number: string,
  name: string,
  part: string,
  available: string,
  price: string,
): ItemOption {
  return {
    number,
    name,
    detail: part,
    description: name,
    unit: "PCS",
    availableStock: available,
    unitPrice: { masked: false, value: price },
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** Finds items by number, name or part number, slowly enough to show it. */
export const searchGalleryItems: ItemSearch = async (query, signal) => {
  await wait(300, signal);
  const needle = query.trim().toLowerCase();
  return GALLERY_STOCK.filter((item) =>
    `${item.number} ${item.name} ${item.detail ?? ""}`
      .toLowerCase()
      .includes(needle),
  );
};

/** The gallery's own schema. A real order's lives in `packages/shared`. */
export function makeLinesSchema(t: TFunction<"gallery">) {
  const line = z.object({
    lineId: z.string(),
    item: requiredLookup(t("lines.errors.item")),
    description: z.string().max(100, t("lines.errors.description")),
    quantity: z.string().regex(/^[1-9]\d{0,6}(\.\d{1,4})?$/, {
      message: t("lines.errors.quantity"),
    }),
    unitPrice: z.string().regex(/^(\d{1,9}(\.\d{1,4})?)?$/, {
      message: t("lines.errors.unitPrice"),
    }),
    unit: z.string(),
    availableStock: z.string().nullable(),
  });
  return z.object({ lines: z.array(line).min(1, t("lines.errors.none")) });
}
export type LinesInput = z.input<ReturnType<typeof makeLinesSchema>>;
export type LinesOutput = z.output<ReturnType<typeof makeLinesSchema>>;

/** The API sends no price to a role that may not see them, so there is none to hold. */
export function startingLines(withPrices = true): LineValue[] {
  const [mouse, keyboard] = GALLERY_STOCK;
  return [
    {
      ...emptyLine(),
      item: { number: "I-0001", name: mouse?.name ?? "" },
      description: mouse?.name ?? "",
      quantity: "3",
      unitPrice: withPrices ? "19.99" : "",
      unit: "PCS",
      availableStock: mouse?.availableStock ?? null,
    },
    {
      ...emptyLine(),
      item: { number: "I-0002", name: keyboard?.name ?? "" },
      description: keyboard?.name ?? "",
      quantity: "12",
      unitPrice: withPrices ? "24.90" : "",
      unit: "PCS",
      availableStock: keyboard?.availableStock ?? null,
    },
  ];
}

/** Two hundred lines, to feel how typing holds up in a long order. */
export function manyLines(withPrices = true, count = 200): LineValue[] {
  return Array.from({ length: count }, (_, index) => {
    const item = GALLERY_STOCK[index % GALLERY_STOCK.length];
    return {
      ...emptyLine(),
      item: { number: item?.number ?? "", name: item?.name ?? "" },
      description: item?.name ?? "",
      quantity: String((index % 9) + 1),
      unitPrice: withPrices ? (item?.unitPrice?.value ?? "") : "",
      unit: "PCS",
      availableStock: item?.availableStock ?? null,
    };
  });
}

export type LinesAnswer = "saves" | "refuses";
export type LinesViewer = "support" | "warehouse";

/** What a real API would answer, with the totals it worked out for itself. */
export async function fakeLinesSave(
  answer: LinesAnswer,
  values: LinesOutput,
  t: TFunction<"gallery">,
): Promise<ServerTotals> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (answer === "refuses") {
    const item = values.lines[1]?.item.number ?? "";
    throw new ApiError(
      "VALIDATION_FAILED",
      "The request is not valid.",
      400,
      "trace-demo-lines-0001",
      [
        {
          path: "lines.1.quantity",
          message: t("lines.server.stock", { item }),
        },
      ],
    );
  }
  const amounts = values.lines.flatMap((line) => {
    const amount = lineAmount(line.quantity, line.unitPrice);
    return amount === null ? [] : [amount];
  });
  return {
    quantity: sumDecimal(values.lines.map((line) => line.quantity)),
    amount: sumDecimal(amounts),
  };
}
