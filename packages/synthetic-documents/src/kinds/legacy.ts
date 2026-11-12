import { FieldBook } from "../book.js";
import { fieldsOf } from "../build-fields.js";
import { DOUBTFUL, reviewCount } from "../confidence.js";
import { defineKind, type AnyDefinition } from "../definition.js";
import { factsFor, type DocumentFacts } from "../facts.js";
import { allSpecs } from "../fields.js";
import { LAYOUTS } from "../layouts/index.js";
import type { Direction, LegacyKind } from "../model.js";

interface Meta {
  title: string;
  name: string;
  stemPrefix: string;
  direction: Direction;
}

const META: Record<LegacyKind, Meta> = {
  CUSTOMER_PO: {
    title: "Customer purchase order",
    name: "Customer PO",
    stemPrefix: "po",
    direction: "inbound",
  },
  PROFORMA_INVOICE: {
    title: "Proforma invoice",
    name: "Proforma invoice",
    stemPrefix: "pi",
    direction: "outbound",
  },
  PACKING_LIST: {
    title: "Packing list",
    name: "Packing list",
    stemPrefix: "pl",
    direction: "outbound",
  },
  SALES_INVOICE: {
    title: "Commercial invoice",
    name: "Commercial invoice",
    stemPrefix: "invoice",
    direction: "outbound",
  },
};

/**
 * Wraps one of the four original kinds. The layouts take the original `Fields`
 * shape, so the book is made from it and the drawer rebuilds it: both are
 * pure and cheap, and not touching four layouts is worth one extra call.
 */
function legacy(kind: LegacyKind): AnyDefinition {
  return defineKind<DocumentFacts>({
    kind,
    type: kind,
    ...META[kind],
    subject: "order",
    stages: [],
    facts: (ctx, subject) => {
      const { order, pinnedOrder, customer } = subject;
      if (!order || !pinnedOrder || !customer) {
        throw new Error(`A ${kind} hangs on an order`);
      }
      return factsFor(order, pinnedOrder, customer, ctx.item, kind);
    },
    fields: (facts) => new FieldBook(allSpecs(fieldsOf(facts))),
    draw: (canvas, facts) => {
      LAYOUTS[facts.layout](canvas, facts, fieldsOf(facts));
    },
    doubtful: DOUBTFUL,
    doubtfulCount: (ctx, subject) => {
      if (kind !== "CUSTOMER_PO" || !subject.order) return 0;
      const no = subject.order.header.no;
      // Looked up by number in the dataset given, so an order that lives
      // beside it has no review task and no doubtful field.
      const task = ctx.dataset.tasks.find(
        (t) => t.orderNo === no && t.kind === "REVIEW_FIELDS",
      );
      return reviewCount(no, task?.title);
    },
  });
}

export const LEGACY_DEFINITIONS: Record<LegacyKind, AnyDefinition> = {
  CUSTOMER_PO: legacy("CUSTOMER_PO"),
  PROFORMA_INVOICE: legacy("PROFORMA_INVOICE"),
  PACKING_LIST: legacy("PACKING_LIST"),
  SALES_INVOICE: legacy("SALES_INVOICE"),
};
