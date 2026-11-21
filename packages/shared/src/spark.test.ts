import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "./permissions.js";
import { ROLES } from "./roles.js";
import {
  SPARK_ERROR_CODES,
  SPARK_QUESTION_MAX_LENGTH,
  sparkAskSchema,
  sparkCreateConversationSchema,
  sparkMessageSchema,
} from "./spark.js";

describe("the spark.use permission", () => {
  it("is named, and held by every role except the System admin by default", () => {
    expect(PERMISSIONS).toContain("spark.use");
    for (const role of ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role].includes("spark.use"), role).toBe(
        role !== "SYSTEM_ADMIN",
      );
    }
  });
});

describe("Spark's request schemas", () => {
  it("trims a question, and refuses an empty one, a long one and another field", () => {
    expect(sparkAskSchema.parse({ question: "  Hello  " })).toEqual({
      question: "Hello",
    });
    expect(sparkAskSchema.safeParse({ question: "   " }).success).toBe(false);
    expect(
      sparkAskSchema.safeParse({
        question: "x".repeat(SPARK_QUESTION_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      sparkAskSchema.safeParse({
        question: "x".repeat(SPARK_QUESTION_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      sparkAskSchema.safeParse({ question: "Hello", role: "APPROVER" }).success,
    ).toBe(false);
  });

  it("takes an empty conversation or a short title, and nothing else", () => {
    expect(sparkCreateConversationSchema.safeParse({}).success).toBe(true);
    expect(
      sparkCreateConversationSchema.safeParse({ title: "Late orders" }).success,
    ).toBe(true);
    expect(
      sparkCreateConversationSchema.safeParse({ title: "x".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      sparkCreateConversationSchema.safeParse({ userId: "x" }).success,
    ).toBe(false);
  });
});

describe("a Spark message", () => {
  const message = {
    id: "0192f3c4-7b1e-7c3a-9d2f-5a6b7c8d9e0f",
    conversationId: "0192f3c4-7b1e-7c3a-9d2f-5a6b7c8d9e10",
    seq: 2,
    role: "ASSISTANT",
    status: "FAILED",
    text: "",
    sources: [],
    steps: [],
    provider: null,
    errorCode: "refused",
    createdAt: "2026-11-22T09:00:00.000Z",
  };

  it("carries a failed answer as a code and no text", () => {
    expect(sparkMessageSchema.parse(message)).toEqual(message);
  });

  it("refuses an error code that is not on the short list, so a message or a rule cannot travel as one", () => {
    expect(SPARK_ERROR_CODES).toContain("refused");
    expect(
      sparkMessageSchema.safeParse({ ...message, errorCode: "real-data-rule" })
        .success,
    ).toBe(false);
  });
});
