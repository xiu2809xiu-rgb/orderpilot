// The contract of Spark's routes (P-95): a person's conversations with the
// assistant, and the question and answer of each turn. Spark answers through
// the AI gateway with read-only tools that run as the person asking, and
// nothing it says writes, approves, posts, pays or sends.

import { z } from "zod";
import { dataEnvelope, pageEnvelope } from "./envelope.js";
import { aiProviderSettingSchema } from "./ai.js";

/** The longest question. A longer one is refused: the model is paid for by the token. */
export const SPARK_QUESTION_MAX_LENGTH = 2000;
export const SPARK_TITLE_MAX_LENGTH = 120;

export const SPARK_MESSAGE_ROLES = ["USER", "ASSISTANT"] as const;
export const sparkMessageRoleSchema = z.enum(SPARK_MESSAGE_ROLES);
export type SparkMessageRole = z.infer<typeof sparkMessageRoleSchema>;

/**
 * How an answer ended. A question is always OK. STOPPED is for a person who
 * stopped a streamed answer, which a later step adds.
 */
export const SPARK_MESSAGE_STATUSES = ["OK", "FAILED", "STOPPED"] as const;
export const sparkMessageStatusSchema = z.enum(SPARK_MESSAGE_STATUSES);
export type SparkMessageStatus = z.infer<typeof sparkMessageStatusSchema>;

/**
 * Why an answer failed, as a short code and never a message: the web words it.
 * These are the gateway's outcomes reduced to what a person may be told, so a
 * rule of the destination check is not named to whoever is probing it.
 */
export const SPARK_ERROR_CODES = [
  // The destination check or a permission said no.
  "refused",
  "timeout",
  "provider-error",
  "invalid-output",
  "too-many-steps",
  "internal",
  // A question nobody answered in time, closed so the thread is not stuck.
  "abandoned",
] as const;
export const sparkErrorCodeSchema = z.enum(SPARK_ERROR_CODES);
export type SparkErrorCode = z.infer<typeof sparkErrorCodeSchema>;

/**
 * What a tool read to answer, labelled in the app as what Spark looked at. The
 * server builds each one from a tool's result, never from the model's words.
 * The web makes the link from its own routes.
 */
export const SPARK_SOURCE_KINDS = [
  "order",
  "item",
  "exception",
  "kpi",
  "query",
  "document",
] as const;
export const sparkSourceSchema = z.object({
  kind: z.enum(SPARK_SOURCE_KINDS),
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});
export type SparkSource = z.infer<typeof sparkSourceSchema>;

/** A tool the model asked for: whether it ran, was refused or failed. */
export const sparkStepSchema = z.object({
  tool: z.string().min(1).max(64),
  status: z.enum(["ran", "refused", "failed"]),
  durationMs: z.int().min(0).optional(),
});
export type SparkStep = z.infer<typeof sparkStepSchema>;

/** Which provider and model wrote an answer, so the app can say "Mock AI". */
export const sparkProviderSchema = z.object({
  provider: aiProviderSettingSchema,
  model: z.string().min(1),
  mock: z.boolean(),
});
export type SparkProvider = z.infer<typeof sparkProviderSchema>;

/**
 * Tokens and cost are not here: the usage record of the call holds them, for
 * those who may read AI use. `text` is empty for a failed answer, and
 * `errorCode` says why.
 */
export const sparkMessageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  /** 1, 2, 3 ... within the conversation. */
  seq: z.int().min(1),
  role: sparkMessageRoleSchema,
  status: sparkMessageStatusSchema,
  text: z.string(),
  sources: z.array(sparkSourceSchema),
  steps: z.array(sparkStepSchema),
  provider: sparkProviderSchema.nullable(),
  errorCode: sparkErrorCodeSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type SparkMessage = z.infer<typeof sparkMessageSchema>;

/** A conversation as a list shows it. The title is null until the first question. */
export const sparkConversationSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  messageCount: z.int().min(0),
});
export type SparkConversation = z.infer<typeof sparkConversationSchema>;

export const sparkConversationParamsSchema = z.object({
  conversationId: z.uuid(),
});

/** Strict, so a client cannot slip a field the server would one day read. */
export const sparkCreateConversationSchema = z.strictObject({
  title: z.string().trim().min(1).max(SPARK_TITLE_MAX_LENGTH).optional(),
});
export type SparkCreateConversation = z.infer<
  typeof sparkCreateConversationSchema
>;

export const sparkAskSchema = z.strictObject({
  question: z.string().trim().min(1).max(SPARK_QUESTION_MAX_LENGTH),
});
export type SparkAsk = z.infer<typeof sparkAskSchema>;

export const sparkConversationListResponseSchema = pageEnvelope(
  sparkConversationSchema,
);
export const sparkConversationResponseSchema = dataEnvelope(
  sparkConversationSchema,
);

export const sparkConversationDetailSchema = z.object({
  conversation: sparkConversationSchema,
  messages: z.array(sparkMessageSchema),
});
export type SparkConversationDetail = z.infer<
  typeof sparkConversationDetailSchema
>;
export const sparkConversationDetailResponseSchema = dataEnvelope(
  sparkConversationDetailSchema,
);

/** A failed answer is still a 201 with `status: FAILED`: the thread keeps it. */
export const sparkAskResultSchema = z.object({
  question: sparkMessageSchema,
  answer: sparkMessageSchema,
});
export type SparkAskResult = z.infer<typeof sparkAskResultSchema>;
export const sparkAskResponseSchema = dataEnvelope(sparkAskResultSchema);
