import type { DocumentType, SalesHeader } from "@orderpilot/shared";
import { atHour } from "./dates.js";
import type { Journey } from "./journey.js";
import { syntheticId, type RecordNumberer } from "./records.js";
import {
  SAMPLE_SCREEN_STATES,
  type DocumentStatus,
  type OrderDocument,
  type OrderOwners,
  type SampleScenario,
} from "./types.js";

export interface DocumentFactory {
  readonly numberer: RecordNumberer;
  nextId(): string;
}

export function documentFactory(numberer: RecordNumberer): DocumentFactory {
  let n = 0;
  return { numberer, nextId: () => syntheticId(7, ++n) };
}

export interface DocumentInput {
  header: SalesHeader;
  journey: Journey;
  owners: OrderOwners;
  scenario: SampleScenario;
  /** AWB for air freight, bill of lading for sea. */
  transport: "AWB" | "BILL_OF_LADING";
  /** The sales invoice number, once Navision has posted one. */
  invoiceNo: string | null;
}

/**
 * The documents an order has by now, worked out from how far it has come: the
 * PO always, then a PI, payment advice, packing list, shipping document and
 * invoice as the sample state implies. A document that is due and not here is
 * listed as `expected`, with its due date.
 */
export function makeDocuments(
  input: DocumentInput,
  factory: DocumentFactory,
): OrderDocument[] {
  const { header, journey, owners, scenario } = input;
  const rank = SAMPLE_SCREEN_STATES.indexOf(journey.state);
  const orderNo = header.no;
  const docs: OrderDocument[] = [];
  const add = (
    type: DocumentType,
    number: string | null,
    status: DocumentStatus,
    when: string | null,
    extra: {
      source?: OrderDocument["source"];
      dueDate?: string;
      by?: string;
    } = {},
  ): void => {
    const id = factory.nextId();
    docs.push({
      id,
      orderNo,
      type,
      number,
      fileName: number
        ? `${number}.pdf`
        : `${orderNo}-${type.toLowerCase()}.pdf`,
      status,
      source: extra.source ?? "email",
      receivedAt: when ? atHour(when, 2 + (docs.length % 6)) : null,
      dueDate: extra.dueDate ?? null,
      confirmedBy: status === "confirmed" ? (extra.by ?? owners.support) : null,
    });
  };

  add(
    "CUSTOMER_PO",
    header.externalDocumentNo,
    rank >= 2 ? "confirmed" : "to-confirm",
    header.orderDate,
    { source: Number(orderNo.slice(3)) % 3 === 0 ? "upload" : "email" },
  );

  if (rank >= 4) {
    const draft = rank === 4;
    const day = journey.done.pi ?? journey.enteredOn;
    add(
      "PROFORMA_INVOICE",
      factory.numberer.next("PI", day),
      draft ? "to-confirm" : "confirmed",
      day,
      { source: "orderpilot" },
    );
  }

  const prepaid = Number(header.prepaymentPercent) > 0;
  if (rank >= 6 && prepaid && journey.done.paid) {
    add(
      "PAYMENT_ADVICE",
      `TT-${orderNo.slice(3)}-PRE`,
      "confirmed",
      journey.done.paid,
      {
        by: owners.finance,
      },
    );
  }

  if (rank === 7) {
    add(
      "PACKING_LIST",
      `PL-${orderNo.slice(3)}`,
      "to-confirm",
      journey.enteredOn,
      {
        source: "upload",
      },
    );
  } else if (rank >= 8) {
    add(
      "PACKING_LIST",
      `PL-${orderNo.slice(3)}`,
      "confirmed",
      journey.done.packed ?? journey.enteredOn,
      {
        source: "upload",
        by: owners.warehouse,
      },
    );
  }

  if (scenario.kind === "awb-overdue") {
    add(input.transport, null, "expected", null, { dueDate: scenario.dueDate });
  } else if (rank >= 9 && header.packageTrackingNo) {
    add(
      input.transport,
      header.packageTrackingNo,
      "confirmed",
      journey.done.shipped ?? journey.enteredOn,
      {
        by: owners.logistics,
      },
    );
  }

  if (scenario.kind === "import-permit-missing") {
    add("IMPORT_PERMIT", null, "expected", null, { dueDate: scenario.dueDate });
  }

  if (rank >= 10 && input.invoiceNo && journey.done.invoiced) {
    add("SALES_INVOICE", input.invoiceNo, "confirmed", journey.done.invoiced, {
      source: "navision",
      by: owners.finance,
    });
  }
  return docs;
}
