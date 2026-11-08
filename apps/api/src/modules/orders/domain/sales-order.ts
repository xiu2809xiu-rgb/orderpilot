import {
  compareDecimal,
  isDecimalString,
  lineAmount,
  parseRecordNumber,
  sumDecimal,
  type FieldIssue,
  type OrderCaptureState,
} from "@orderpilot/shared";
import { ValidationFailedError } from "../../../common/domain-error.js";
import type { OrderFacts, OrderFactsLine } from "./order-facts.js";

export type SalesOrderLineInput = OrderFactsLine;

/** One line of a stored order. The amount is worked out, never stored. */
export class SalesOrderLine {
  constructor(private readonly input: SalesOrderLineInput) {
    const at = `lines.${String(input.lineNo)}`;
    const issues: FieldIssue[] = [];
    const add = (field: string, message: string): void => {
      issues.push({ path: `${at}.${field}`, message });
    };
    if (!Number.isInteger(input.lineNo) || input.lineNo < 1)
      add("lineNo", "A line number starts at 1.");
    if (input.itemNo.trim() === "")
      add("itemNo", "Name the item by its Navision number.");
    if (
      !isDecimalString(input.quantity) ||
      compareDecimal(input.quantity, "0") <= 0
    )
      add("quantity", "The quantity must be more than zero.");
    if (
      !isDecimalString(input.unitPrice) ||
      compareDecimal(input.unitPrice, "0") < 0
    )
      add("unitPrice", "The price cannot be negative.");
    if (
      !isDecimalString(input.qtyToShip) ||
      compareDecimal(input.qtyToShip, "0") < 0
    )
      add("qtyToShip", "The quantity to ship cannot be negative.");
    if (issues.length > 0) throw new ValidationFailedError(issues);
  }

  get lineNo(): number {
    return this.input.lineNo;
  }
  get itemNo(): string {
    return this.input.itemNo;
  }
  get description(): string {
    return this.input.description;
  }
  get quantity(): string {
    return this.input.quantity;
  }
  get unitPrice(): string {
    return this.input.unitPrice;
  }
  get qtyToShip(): string {
    return this.input.qtyToShip;
  }

  /** Quantity times unit price, to the cent. */
  get amount(): string {
    return lineAmount(this.input.quantity, this.input.unitPrice) ?? "0.00";
  }

  toFacts(): OrderFactsLine {
    return { ...this.input };
  }
}

export interface SalesOrderInput {
  readonly orderNo: string;
  readonly navisionNo: string | null;
  readonly captureState: OrderCaptureState;
  readonly customerNo: string;
  readonly externalDocumentNo: string;
  /** `YYYY-MM-DD`. */
  readonly orderDate: string;
  readonly shipmentDate: string | null;
  readonly currencyCode: string;
  readonly prepaymentPercent: string;
  readonly createdBy: string;
  readonly lines: readonly SalesOrderLineInput[];
}

/**
 * An order OrderPilot stores itself. The rules that need no database live
 * here, so they are tested alone: the number is a record number of type SO,
 * each line is numbered once, and a prepayment is a percentage.
 */
export class SalesOrder {
  readonly lines: readonly SalesOrderLine[];

  constructor(private readonly input: SalesOrderInput) {
    const issues: FieldIssue[] = [];
    const add = (field: string, message: string): void => {
      issues.push({ path: field, message });
    };
    if (parseRecordNumber(input.orderNo)?.type !== "SO")
      add("orderNo", "Use a number like SO-20261108-0001.");
    if (input.customerNo.trim() === "")
      add("customerNo", "Name the customer by their Navision number.");
    if (input.externalDocumentNo.trim() === "")
      add("externalDocumentNo", "Give the PO number the customer used.");
    if (
      !isDecimalString(input.prepaymentPercent) ||
      compareDecimal(input.prepaymentPercent, "0") < 0 ||
      compareDecimal(input.prepaymentPercent, "100") > 0
    )
      add("prepaymentPercent", "A prepayment is between 0 and 100.");
    if (input.lines.length === 0)
      add("lines", "An order needs at least one line.");
    const numbers = input.lines.map((line) => line.lineNo);
    if (new Set(numbers).size !== numbers.length)
      add("lines", "Each line number is used once.");
    if (issues.length > 0) throw new ValidationFailedError(issues);
    this.lines = input.lines.map((line) => new SalesOrderLine(line));
  }

  get orderNo(): string {
    return this.input.orderNo;
  }
  get navisionNo(): string | null {
    return this.input.navisionNo;
  }
  get captureState(): OrderCaptureState {
    return this.input.captureState;
  }
  get customerNo(): string {
    return this.input.customerNo;
  }
  get externalDocumentNo(): string {
    return this.input.externalDocumentNo;
  }
  get orderDate(): string {
    return this.input.orderDate;
  }
  get shipmentDate(): string | null {
    return this.input.shipmentDate;
  }
  get currencyCode(): string {
    return this.input.currencyCode;
  }
  get prepaymentPercent(): string {
    return this.input.prepaymentPercent;
  }
  get createdBy(): string {
    return this.input.createdBy;
  }

  /** The sum of the line amounts. */
  get total(): string {
    return sumDecimal(this.lines.map((line) => line.amount));
  }

  /** A stored order has no workflow status and no stock figure of its own yet. */
  toFacts(): OrderFacts {
    return {
      orderNo: this.orderNo,
      source: "stored",
      captureState: this.captureState,
      customerNo: this.customerNo,
      externalDocumentNo: this.externalDocumentNo,
      orderDate: this.orderDate,
      shipmentDate: this.shipmentDate,
      currencyCode: this.currencyCode,
      prepaymentPercent: this.prepaymentPercent,
      navisionNo: this.navisionNo,
      workflowStatus: null,
      total: this.total,
      lines: this.lines.map((line) => line.toFacts()),
      stockShortfall: null,
      overdue: null,
    };
  }
}
