import {
  sparkSourceSchema,
  sparkStepSchema,
  type SparkMessageRole,
  type SparkMessageStatus,
} from "@orderpilot/shared";
import type { z } from "zod";
import type { AiInputMessage } from "../../ai/llm-gateway.js";

/** How many earlier messages go back to the model: five questions and their answers at most. */
export const HISTORY_MESSAGE_LIMIT = 10;

/** What the history needs of a stored message. */
export interface StoredTurn {
  readonly role: SparkMessageRole;
  readonly status: SparkMessageStatus;
  readonly content: string;
  /** JSON as stored. It is parsed again here, so a bad row costs a line of history and no more. */
  readonly sources: unknown;
  readonly steps: unknown;
  readonly errorCode: string | null;
}

// A tool's name and a record's id are the only strings of a stored answer that
// reach the next turn, and only when they look like names and ids.
const TOOL_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const RECORD_ID = /^[A-Za-z0-9._:/-]{1,64}$/;

/** The entries of a stored JSON list that fit the schema, one by one: a bad entry costs itself and no more. */
function entriesOf<T>(list: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(list)) return [];
  return (list as unknown[]).flatMap((entry) => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function toolsOf(steps: unknown): string[] {
  return [
    ...new Set(
      entriesOf(steps, sparkStepSchema)
        .filter((step) => step.status === "ran" && TOOL_NAME.test(step.tool))
        .map((step) => step.tool),
    ),
  ];
}

function sourcesOf(sources: unknown): string[] {
  return entriesOf(sources, sparkSourceSchema)
    .filter((source) => RECORD_ID.test(source.id))
    .map((source) => `${source.kind} ${source.id}`);
}

const listOf = (items: readonly string[]): string =>
  items.length === 0 ? "none" : items.join(", ");

/**
 * What an earlier answer is replayed as. The server writes it: the answer's own
 * prose is never sent back, nor a source's label, because both can carry text
 * that came out of a record or a document (an order's description, a task's
 * title) and would then reach the model as an unfenced turn of the assistant.
 * What is left is the tools that ran, the ids they read, and the outcome.
 */
function summaryOf(turn: StoredTurn): string {
  if (turn.status === "FAILED") {
    return `Spark could not answer this question. Reason code: ${turn.errorCode ?? "unknown"}.`;
  }
  if (turn.status === "STOPPED") {
    return "Spark's answer to this question was stopped before it finished.";
  }
  return [
    "Spark answered this question.",
    `Tools it used: ${listOf(toolsOf(turn.steps))}.`,
    `Records it looked at: ${listOf(sourcesOf(turn.sources))}.`,
  ].join(" ");
}

/**
 * The earlier turns of a conversation, as the gateway takes them. A person's
 * own words go back as they wrote them. Spark's answers go back only in the
 * form `summaryOf` builds. The model is told to treat anything in a tool result
 * as data; this keeps what it said last time from being a way round that.
 */
export function historyOf(turns: readonly StoredTurn[]): AiInputMessage[] {
  const recent = turns.slice(-HISTORY_MESSAGE_LIMIT);
  // A window that opens on an answer has lost its question: start at a question.
  const firstQuestion = recent.findIndex((turn) => turn.role === "USER");
  if (firstQuestion === -1) return [];
  return recent
    .slice(firstQuestion)
    .map((turn) =>
      turn.role === "USER"
        ? { role: "user", text: turn.content }
        : { role: "assistant", text: summaryOf(turn) },
    );
}
