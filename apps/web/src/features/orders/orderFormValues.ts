import type {
  CreateSalesOrderBody,
  PatchSalesOrderBody,
  SalesOrderDetail,
} from "@orderpilot/shared";
import type { UseFormReturn } from "react-hook-form";
import {
  emptyLine,
  type LastPrice,
  type LineValue,
} from "@/components/lines-grid";
import type { OrderFormInput, OrderFormOutput } from "./orderFormSchema";

export type OrderForm = UseFormReturn<OrderFormInput, unknown, OrderFormOutput>;

/** Customers prepay before goods ship, so a new order starts at the whole amount. */
const STARTING_PREPAYMENT = "100.00";

/** The API reports quantities to three decimals: 10.000 reads as 10. */
function plainQuantity(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Prices and percentages keep two decimals, whatever more the API added. */
function twoDecimals(value: string): string {
  return value.replace(/(\.\d{2})0+$/, "$1");
}

/** An order with nothing in it yet. The date is today, in Singapore. */
export function blankOrder(today: string): OrderFormInput {
  return {
    version: null,
    customer: null,
    externalDocumentNo: "",
    orderDate: today,
    shipmentDate: "",
    prepaymentPercent: STARTING_PREPAYMENT,
    currency: "USD",
    lines: [emptyLine()],
  };
}

/**
 * The form's values for a saved order. A saved line brings a name that stays
 * the same from one visit to the next, so a restored draft matches its rows.
 * The unit and the stock are not saved: the availability poll fills them.
 */
export function fromDetail(record: SalesOrderDetail): OrderFormInput {
  return {
    version: record.version,
    customer: { number: record.customerNo, name: record.customerName ?? "" },
    externalDocumentNo: record.externalDocumentNo,
    orderDate: record.orderDate,
    shipmentDate: record.shipmentDate ?? "",
    prepaymentPercent: twoDecimals(record.prepaymentPercent),
    currency: record.currencyCode,
    lines: record.lines.map<LineValue>((line) => ({
      lineId: `${record.orderNo}-${String(line.lineNo)}`,
      item: { number: line.itemNo, name: line.description },
      description: line.description,
      quantity: plainQuantity(line.quantity),
      unitPrice:
        line.unitPrice.masked || line.unitPrice.value === null
          ? ""
          : twoDecimals(line.unitPrice.value),
      unit: "",
      availableStock: null,
    })),
  };
}

function bodyOf(
  values: OrderFormOutput,
  priceMasked: boolean,
): CreateSalesOrderBody {
  return {
    customerNo: values.customer.number,
    externalDocumentNo: values.externalDocumentNo,
    orderDate: values.orderDate,
    shipmentDate: values.shipmentDate === "" ? null : values.shipmentDate,
    prepaymentPercent: values.prepaymentPercent,
    lines: values.lines.map((line) => ({
      itemNo: line.item.number,
      ...(line.description.trim() === ""
        ? {}
        : { description: line.description }),
      quantity: line.quantity,
      // A role that cannot see prices sends none, and the server keeps its own.
      ...(priceMasked ? {} : { unitPrice: line.unitPrice }),
    })),
  };
}

export const toCreateBody = bodyOf;

/** Every field again, with the version the form was typed against. */
export function toPatchBody(
  values: OrderFormOutput,
  priceMasked: boolean,
): PatchSalesOrderBody & { version: number } {
  return { ...bodyOf(values, priceMasked), version: values.version ?? 1 };
}

/**
 * Records the version a save answered with. `useFormSave` has just made the
 * sent values the clean state, so the new version has to become the default as
 * well as the value, or the form would look changed and a draft would be
 * written for it. The reset moves the default and keeps what was typed since;
 * the value is then set without marking it changed.
 *
 * The defaults are read from the control, which holds them as of this moment:
 * `form.formState.defaultValues` is the object of the last render, and an
 * earlier one would put the record the page opened with back as the default.
 */
export function setOrderVersion(form: OrderForm, version: number): void {
  form.reset(
    { ...form.control._defaultValues, version },
    { keepValues: true, keepDirty: true, keepErrors: true, keepTouched: true },
  );
  form.setValue("version", version);
}

/** The stock and the unit the server reported for one line. */
export interface LineFigures {
  index: number;
  itemNo: string;
  /** Null is Not known: the poll failed, or the answer left the item out. */
  availableStock: string | null;
  /** Null keeps the unit the line already has. */
  unit: string | null;
}

/**
 * Writes what a poll learned about the lines, as the lines' defaults and as
 * their values, without marking the form changed. A value alone is not
 * enough: the form then differs from its defaults, and the next recount of
 * "changed" (a focus or a blur) calls a form nobody touched edited, which
 * blocks Void. It matters when the figures are already known as the page
 * opens, such as for a draft just saved from the new-order page. A default
 * counts only for the same item on the same line, so a line moved or
 * replaced since the page opened is left to the person's edit.
 */
export function setLineFigures(
  form: OrderForm,
  figures: readonly LineFigures[],
): void {
  if (figures.length === 0) return;
  const defaults = form.control._defaultValues;
  const lines = (defaults.lines ?? []).map((line, index) => {
    const figure = figures.find((entry) => entry.index === index);
    if (!line || !figure || line.item?.number !== figure.itemNo) return line;
    return {
      ...line,
      availableStock: figure.availableStock,
      ...(figure.unit === null ? {} : { unit: figure.unit }),
    };
  });
  form.reset(
    { ...defaults, lines },
    { keepValues: true, keepDirty: true, keepErrors: true, keepTouched: true },
  );
  for (const figure of figures) {
    const at = `lines.${String(figure.index)}` as `lines.${number}`;
    form.setValue(`${at}.availableStock`, figure.availableStock, {
      shouldDirty: false,
    });
    if (figure.unit !== null) {
      form.setValue(`${at}.unit`, figure.unit, { shouldDirty: false });
    }
  }
}

/** What the customer last paid for one line's item, "none" if never bought, or "unknown" if the lookup failed. */
export interface LinePrice {
  index: number;
  /** Guards the write: a line moved or replaced since is left alone. */
  itemNo: string;
  lastPrice: LastPrice | "none" | "unknown" | null;
}

/**
 * Writes the customers' last agreed prices beside the lines, the way
 * `setLineFigures` writes stock: as defaults and as values, never marking
 * the form changed, because a lookup is not the person's edit.
 */
export function setLinePrices(
  form: OrderForm,
  prices: readonly LinePrice[],
): void {
  if (prices.length === 0) return;
  const defaults = form.control._defaultValues;
  const lines = (defaults.lines ?? []).map((line, index) => {
    const found = prices.find((entry) => entry.index === index);
    if (!line || !found || line.item?.number !== found.itemNo) return line;
    return { ...line, lastPrice: found.lastPrice };
  });
  form.reset(
    { ...defaults, lines },
    { keepValues: true, keepDirty: true, keepErrors: true, keepTouched: true },
  );
  for (const found of prices) {
    const at = `lines.${String(found.index)}` as `lines.${number}`;
    form.setValue(`${at}.lastPrice`, found.lastPrice, { shouldDirty: false });
  }
}
