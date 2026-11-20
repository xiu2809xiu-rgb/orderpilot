import {
  compareDecimal,
  isDecimalString,
  lineAmount,
  parseRecordNumber,
  SHIPMENT_BEFORE_ORDER_MESSAGE,
  shipmentIsBeforeOrder,
  sumDecimal,
  type FieldIssue,
  type OrderCaptureState,
} from "@orderpilot/shared";
import {
  ConflictError,
  ValidationFailedError,
} from "../../../common/domain-error.js";
import { isTotalHoldable, TOTAL_TOO_LARGE } from "./draft-lines.js";
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
      add("itemNo", "Name the item by its Business Central number.");
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
  /** Counts the saves. Many fixtures leave it out, and a new order is at 1. */
  readonly version?: number | undefined;
  readonly lines: readonly SalesOrderLineInput[];
}

/** What a person may change on a draft. The number, the creator and the state are not here. */
export interface SalesOrderChanges {
  readonly customerNo?: string | undefined;
  readonly externalDocumentNo?: string | undefined;
  readonly orderDate?: string | undefined;
  readonly shipmentDate?: string | null | undefined;
  readonly prepaymentPercent?: string | undefined;
  readonly lines?: readonly SalesOrderLineInput[] | undefined;
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
      add("customerNo", "Name the customer by their Business Central number.");
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
    // The order's own guard, whoever built the lines: the list sorts and filters on the total.
    if (!isTotalHoldable(input.lines)) add("lines", TOTAL_TOO_LARGE);
    if (issues.length > 0) throw new ValidationFailedError(issues);
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
  get version(): number {
    return this.input.version ?? 1;
  }
  get isDraft(): boolean {
    return this.input.captureState === "draft";
  }

  /**
   * A copy with the changes, built through the constructor so every rule runs
   * again. Only a draft changes: a submitted order is the record of what was
   * asked for, and a void one is closed.
   */
  edit(changes: SalesOrderChanges): SalesOrder {
    this.requireDraft("changed");
    // An undefined key would overwrite what is held, so only sent keys are kept.
    const sent = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as SalesOrderChanges;
    const edited = new SalesOrder({ ...this.input, ...sent });
    // Checked here and not in the constructor: an order stored before the rule
    // existed still loads, and a client that sends no dates can still edit it.
    // The order form always sends both dates, so for such an order it asks for
    // the date to be put right first. A change that sends one date meets the
    // stored other.
    if (
      ("orderDate" in sent || "shipmentDate" in sent) &&
      shipmentIsBeforeOrder(edited.orderDate, edited.shipmentDate)
    )
      throw new ValidationFailedError([
        { path: "shipmentDate", message: SHIPMENT_BEFORE_ORDER_MESSAGE },
      ]);
    return edited;
  }

  /** A copy that is void. Only a draft can be: cancelling a submitted order is P-50. */
  voided(): SalesOrder {
    this.requireDraft("voided");
    return new SalesOrder({ ...this.input, captureState: "void" });
  }

  /** Throws, with the rule's own words, for anything but a draft. */
  requireDraft(verb: string): void {
    if (!this.isDraft)
      throw new ConflictError(
        `Order ${this.orderNo} is ${this.captureState}, so it cannot be ${verb}. Only a draft can.`,
      );
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
      customerName: null,
      externalDocumentNo: this.externalDocumentNo,
      orderDate: this.orderDate,
      shipmentDate: this.shipmentDate,
      currencyCode: this.currencyCode,
      prepaymentPercent: this.prepaymentPercent,
      navisionNo: this.navisionNo,
      version: this.version,
      workflowStatus: null,
      total: this.total,
      lines: this.lines.map((line) => line.toFacts()),
      stockShortfall: null,
      overdue: null,
    };
  }
}
