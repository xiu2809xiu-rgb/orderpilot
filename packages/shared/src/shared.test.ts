import { describe, expect, it } from "vitest";
import {
  API_BASE_PATH,
  CONFIGURABLE_DOCUMENT_TYPES,
  COOKIES,
  DEMO_PERSONAS,
  DOCUMENT_STAGES,
  DOCUMENT_TYPES,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  HEADERS,
  PERMISSIONS,
  REFRESH_COOKIE_PATH,
  ROLES,
  STAGED_DOCUMENT_TYPES,
  addDecimal,
  aiUsageSchema,
  apiPath,
  authRoutes,
  compareDecimal,
  decimalStringSchema,
  documentRefSchema,
  documentTypeSchema,
  domainEventSchema,
  errorEnvelopeSchema,
  formatRecordNumber,
  isStagedDocumentType,
  multiplyDecimal,
  roundToCents,
  orderSchema,
  pageEnvelope,
  parseRecordNumber,
  recordNumberSchema,
  salesHeaderSchema,
  salesLineSchema,
  textFieldSchema,
} from "./index.js";

const id = "3f1c2a54-8b1e-4c52-9f0a-6d2f0b7a1e11";

describe("roles and permissions", () => {
  it("has nine roles, each with a demo name", () => {
    expect(ROLES).toHaveLength(9);
    for (const role of ROLES)
      expect(DEMO_PERSONAS[role].length).toBeGreaterThan(0);
  });
  it("has unique permissions", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });
});

describe("error envelope", () => {
  it("accepts the documented shape", () => {
    const parsed = errorEnvelopeSchema.parse({
      error: {
        code: "NOT_FOUND",
        message: "No such order",
        details: null,
        traceId: "abc",
      },
    });
    expect(parsed.error.code).toBe("NOT_FOUND");
  });
  it("rejects an unknown code and a missing traceId", () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: "NOPE", message: "x", details: null, traceId: "a" },
      }).success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: "NOT_FOUND", message: "x", details: null },
      }).success,
    ).toBe(false);
  });
  it("gives every code an HTTP status", () => {
    for (const code of ERROR_CODES)
      expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
  });
});

describe("envelopes", () => {
  it("wraps a page with its meta", () => {
    const schema = pageEnvelope(decimalStringSchema);
    expect(
      schema.safeParse({
        data: ["1.00"],
        meta: { page: 1, pageSize: 25, total: 1 },
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ data: ["1.00"] }).success).toBe(false);
  });
});

describe("money", () => {
  it("accepts decimal strings and rejects floats and junk", () => {
    expect(decimalStringSchema.safeParse("1250.50").success).toBe(true);
    expect(decimalStringSchema.safeParse(1250.5).success).toBe(false);
    expect(decimalStringSchema.safeParse("1,250.50").success).toBe(false);
    expect(decimalStringSchema.safeParse("1e3").success).toBe(false);
  });
  it("adds without float error", () => {
    expect(addDecimal("0.10", "0.20")).toBe("0.30");
    expect(addDecimal("10", "-10.50")).toBe("-0.50");
  });
  it("multiplies and rounds", () => {
    expect(multiplyDecimal("12", "3.5")).toBe("42.00");
    expect(multiplyDecimal("0.3333", "3")).toBe("0.9999");
  });
  it("rounds to cents, half away from zero", () => {
    expect(roundToCents("601.596")).toBe("601.60");
    expect(roundToCents("5222.205")).toBe("5222.21");
    expect(roundToCents("5222.2049")).toBe("5222.20");
    expect(roundToCents("-1.005")).toBe("-1.01");
    expect(roundToCents("12")).toBe("12.00");
  });
  it("compares", () => {
    expect(compareDecimal("1.10", "1.1")).toBe(0);
    expect(compareDecimal("2", "10")).toBe(-1);
  });
});

describe("record numbers", () => {
  it("formats in Singapore time", () => {
    // 17:00 UTC on 1 Nov is 01:00 on 2 Nov in Singapore.
    const n = formatRecordNumber("SPR", new Date("2026-11-01T17:00:00Z"), 1);
    expect(n).toBe("SPR-20261102-0001");
    expect(recordNumberSchema.safeParse(n).success).toBe(true);
  });
  it("round-trips and rejects bad numbers", () => {
    expect(parseRecordNumber("PI-20261102-0042")).toEqual({
      type: "PI",
      date: "20261102",
      sequence: 42,
    });
    expect(parseRecordNumber("XYZ-20261102-0001")).toBeNull();
    expect(() => formatRecordNumber("EXC", new Date(), 0)).toThrow(RangeError);
  });
  it("numbers a stored sales order as SO and keeps the other types", () => {
    const at = new Date("2026-11-08T02:00:00Z");
    const n = formatRecordNumber("SO", at, 1);
    expect(n).toBe("SO-20261108-0001");
    expect(recordNumberSchema.safeParse(n).success).toBe(true);
    expect(parseRecordNumber(n)).toEqual({
      type: "SO",
      date: "20261108",
      sequence: 1,
    });
    for (const type of ["SPR", "PI", "EXC"] as const) {
      const other = formatRecordNumber(type, at, 7);
      expect(other).toBe(`${type}-20261108-0007`);
      expect(parseRecordNumber(other)?.type).toBe(type);
    }
  });
  it("does not take a sample order number for a record number", () => {
    expect(recordNumberSchema.safeParse("SO-0001").success).toBe(false);
    expect(parseRecordNumber("SO-0001")).toBeNull();
    expect(parseRecordNumber("XSO-20261108-0001")).toBeNull();
  });
});

describe("order contract", () => {
  const header = {
    no: "SO-1001",
    sellToCustomerNo: "C-10010",
    externalDocumentNo: "PO-7788",
    orderDate: "2026-11-02",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "30",
    shipmentMethodCode: "FOB",
    shippingAgentCode: null,
    packageTrackingNo: null,
    navisionStatus: "Open",
  };
  const line = {
    type: "Item",
    no: "ITM-1",
    description: "Widget",
    quantity: "10",
    unitPrice: "12.50",
    lineAmount: "125.00",
    qtyToShip: "10",
    quantityShipped: "0",
  };
  it("parses a header, a line and an order", () => {
    expect(salesHeaderSchema.safeParse(header).success).toBe(true);
    expect(salesLineSchema.safeParse(line).success).toBe(true);
    const order = {
      id,
      ref: { recordNo: "SPR-20261102-0001", navisionNo: null },
      header,
      lines: [line],
      documents: [],
    };
    expect(orderSchema.safeParse(order).success).toBe(true);
  });
  it("rejects a float amount", () => {
    expect(
      salesLineSchema.safeParse({ ...line, unitPrice: 12.5 }).success,
    ).toBe(false);
  });
  it("carries confidence and provenance on a field", () => {
    const field = {
      value: "PO-7788",
      confidence: 0.93,
      provenance: {
        documentId: id,
        page: 1,
        box: [0.1, 0.2, 0.3, 0.05],
        sourceText: "PO No. 7788",
        method: "ai",
        model: "demo-model",
      },
      review: "extracted",
    };
    expect(textFieldSchema.safeParse(field).success).toBe(true);
    expect(
      textFieldSchema.safeParse({ ...field, confidence: 1.5 }).success,
    ).toBe(false);
  });
  it("parses an event", () => {
    const event = {
      id,
      name: "document.received",
      occurredAt: "2026-11-02T01:00:00Z",
      idempotencyKey: "k1",
      traceId: "t1",
      subject: { type: "document", id },
      actorUserId: null,
      data: {},
    };
    expect(domainEventSchema.safeParse(event).success).toBe(true);
    expect(
      domainEventSchema.safeParse({ ...event, name: "order.exploded" }).success,
    ).toBe(false);
  });
});

describe("document types and stages", () => {
  const ref = {
    id,
    type: "AWB",
    fileName: "awb.pdf",
    receivedAt: "2026-11-02T01:00:00Z",
    source: "upload",
  };
  const unstaged = DOCUMENT_TYPES.filter((type) => !isStagedDocumentType(type));

  it("parses the four kinds added for the briefing", () => {
    for (const type of [
      "VENDOR_INVOICE",
      "DELIVERY_ORDER",
      "SPR_FORM",
      "CREDIT_NOTE",
    ]) {
      expect(documentTypeSchema.safeParse(type).success).toBe(true);
    }
  });
  it("keeps OTHER last and refuses an unknown type", () => {
    expect(DOCUMENT_TYPES.at(-1)).toBe("OTHER");
    expect([...DOCUMENT_TYPES]).toEqual([
      "CUSTOMER_PO",
      "PROFORMA_INVOICE",
      "VENDOR_PI",
      "VENDOR_INVOICE",
      "SALES_INVOICE",
      "CREDIT_NOTE",
      "PACKING_LIST",
      "DELIVERY_ORDER",
      "AWB",
      "BILL_OF_LADING",
      "IMPORT_PERMIT",
      "PAYMENT_ADVICE",
      "SPR_FORM",
      "OTHER",
    ]);
    expect(documentTypeSchema.safeParse("AWB_DRAFT").success).toBe(false);
    expect(
      documentRefSchema.safeParse({ ...ref, type: "RECEIPT" }).success,
    ).toBe(false);
  });
  it("accepts a stage on an AWB and on a bill of lading", () => {
    expect([...STAGED_DOCUMENT_TYPES]).toEqual(["AWB", "BILL_OF_LADING"]);
    for (const type of STAGED_DOCUMENT_TYPES) {
      for (const stage of DOCUMENT_STAGES) {
        expect(
          documentRefSchema.safeParse({ ...ref, type, stage }).success,
        ).toBe(true);
      }
    }
  });
  it("accepts no stage on every type", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(documentRefSchema.safeParse({ ...ref, type }).success).toBe(true);
    }
  });
  it("refuses a stage on any other type, at the path stage", () => {
    expect(unstaged.length).toBe(DOCUMENT_TYPES.length - 2);
    for (const type of unstaged) {
      for (const stage of DOCUMENT_STAGES) {
        const result = documentRefSchema.safeParse({ ...ref, type, stage });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path)).toEqual([
          ["stage"],
        ]);
      }
    }
  });
  it("refuses a stage outside the list", () => {
    expect(
      documentRefSchema.safeParse({ ...ref, stage: "signed" }).success,
    ).toBe(false);
  });
  it("still holds a staged document in an order", () => {
    const order = orderSchema.safeParse({
      id,
      ref: null,
      header: {
        no: "SO-1001",
        sellToCustomerNo: "C-10010",
        externalDocumentNo: "PO-7788",
        orderDate: "2026-11-02",
        shipmentDate: null,
        currencyCode: "USD",
        prepaymentPercent: "30",
        shipmentMethodCode: null,
        shippingAgentCode: null,
        packageTrackingNo: null,
        navisionStatus: null,
      },
      lines: [],
      documents: [{ ...ref, stage: "draft" }],
    });
    expect(order.success).toBe(true);
    expect(order.data?.documents[0]?.stage).toBe("draft");
  });
  it("lists every document type for configuration, and SPR beside them", () => {
    expect(CONFIGURABLE_DOCUMENT_TYPES).toContain("SPR");
    for (const type of DOCUMENT_TYPES) {
      expect(CONFIGURABLE_DOCUMENT_TYPES).toContain(type);
    }
    expect(CONFIGURABLE_DOCUMENT_TYPES).toContain("SPR_FORM");
  });
});

describe("ai usage", () => {
  it("keeps cost as a decimal string", () => {
    const usage = {
      id,
      occurredAt: "2026-11-02T01:00:00Z",
      feature: "extract",
      provider: "p",
      model: "m",
      promptVersion: "1",
      inputTokens: 10,
      outputTokens: 5,
      costUsd: "0.0021",
      latencyMs: 800,
      status: "ok",
      userId: null,
      traceId: "t",
    };
    expect(aiUsageSchema.safeParse(usage).success).toBe(true);
    expect(aiUsageSchema.safeParse({ ...usage, costUsd: 0.0021 }).success).toBe(
      false,
    );
  });
});

describe("auth routes", () => {
  it("has the six routes under /api/v1", () => {
    expect(API_BASE_PATH).toBe("/api/v1");
    expect(
      Object.values(authRoutes).map((r) => `${r.method} ${r.path}`),
    ).toEqual([
      "GET /auth/options",
      "POST /auth/demo-login",
      "POST /auth/login",
      "POST /auth/refresh",
      "POST /auth/logout",
      "GET /auth/me",
    ]);
    expect(apiPath("/auth/me")).toBe("/api/v1/auth/me");
  });
  it("names the cookies and headers", () => {
    expect(COOKIES.refresh).not.toBe(COOKIES.access);
    expect(REFRESH_COOKIE_PATH).toBe("/api/v1/auth");
    expect(HEADERS.csrf).toBe("X-CSRF-Token");
    expect(HEADERS.requestId).toBe("X-Request-Id");
  });
  it("validates the demo options, demo login and login bodies", () => {
    const options = {
      demoMode: true,
      demoRoles: ROLES.map((role) => ({
        role,
        displayName: DEMO_PERSONAS[role],
      })),
    };
    expect(
      authRoutes.options.response.safeParse({ data: options }).success,
    ).toBe(true);
    expect(
      authRoutes.demoLogin.request.safeParse({ role: "APPROVER" }).success,
    ).toBe(true);
    expect(
      authRoutes.demoLogin.request.safeParse({ role: "CEO" }).success,
    ).toBe(false);
    expect(
      authRoutes.login.request.safeParse({ email: "a@b.sg", password: "x" })
        .success,
    ).toBe(true);
    expect(
      authRoutes.login.request.safeParse({ email: "nope", password: "x" })
        .success,
    ).toBe(false);
  });
});
