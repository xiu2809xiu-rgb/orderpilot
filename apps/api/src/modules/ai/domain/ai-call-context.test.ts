import { describe, expect, it } from "vitest";
import type { AiCallContext } from "./ai-call-context.js";

const complete: AiCallContext = {
  feature: "document-extraction",
  promptVersion: "v1",
  classification: "internal",
  origin: "synthetic",
  actor: { userId: "0190a1b2-0000-7000-8000-000000000001", role: "SUPPORT" },
  traceId: "trace-1",
};

describe("the AI call context", () => {
  it("has no default for the origin or the classification: leaving one out does not compile", () => {
    // tsc checks these directives: if a field ever became optional, its
    // directive would be unused and the type check would fail. Each sits on
    // the line with the error, so keep each statement on one line.
    // @ts-expect-error origin is required
    const a1: AiCallContext = { ...complete, origin: undefined };
    // @ts-expect-error classification is required
    const a2: AiCallContext = { ...complete, classification: undefined };
    // @ts-expect-error the actor is a person or an explicit null
    const a3: AiCallContext = { ...complete, actor: undefined };
    expect([a1, a2, a3]).toHaveLength(3);
  });

  it("takes a background job as an explicit null actor and an optional document", () => {
    const job: AiCallContext = { ...complete, actor: null };
    expect(job.actor).toBeNull();
    expect(job.documentId).toBeUndefined();
    const withDocument: AiCallContext = {
      ...complete,
      documentId: "doc-1",
    };
    expect(withDocument.documentId).toBe("doc-1");
  });
});
