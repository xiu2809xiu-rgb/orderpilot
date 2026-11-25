import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  MockScriptRegistry,
  mockText,
  mockToolCalls,
  type MockScript,
  type MockScriptContext,
  type MockToolCallScript,
} from "../ai/providers/mock-scripts.js";
import { SPARK_FEATURE } from "./domain/spark-instructions.js";
import {
  SPARK_CANNOT_REPLY,
  SPARK_REFUSED_REPLY,
  SPARK_UNREADABLE_REPLY,
  ordersSentenceOf,
  orderSentenceOf,
  stockSentenceOf,
  unfenced,
} from "./spark-mock-answers.js";
import { CHECK_STOCK } from "./tools/check-stock.tool.js";
import { FIND_ORDERS } from "./tools/find-orders.tool.js";
import { GET_ORDER } from "./tools/get-order.tool.js";

export { SPARK_CANNOT_REPLY };

/** A tool result as the mock is given it, named from the mock's own types. */
type AiToolResultPart = MockScriptContext["toolResults"][number];

/**
 * The last thing the person said. The script reads this and not `userText`,
 * which joins every user message of the conversation, and not `turn`, which
 * counts earlier answers and so is not zero for a second question. A fresh
 * step is told apart from a step after a tool by the number of tool results.
 */
function lastQuestionOf(context: MockScriptContext): string {
  for (const message of [...context.request.messages].reverse()) {
    if (message.role !== "user") continue;
    return message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n");
  }
  return "";
}

/** The tool a question asks for, or null when Spark has none for it. */
function callFor(question: string): MockToolCallScript | null {
  if (/\bhp\b[^.?!]*\bmonitors?\b/i.test(question)) {
    return { name: CHECK_STOCK, input: { search: "HP Monitor" } };
  }
  const order = /\bSO-[0-9-]{3,20}\b/i.exec(question)?.[0];
  if (order !== undefined) {
    return { name: GET_ORDER, input: { orderNo: order.toUpperCase() } };
  }
  const item = /\bI-\d{4}\b/i.exec(question)?.[0];
  if (item !== undefined) {
    return { name: CHECK_STOCK, input: { search: item.toUpperCase() } };
  }
  const customer = /\bC-\d{4}\b/i.exec(question)?.[0];
  if (customer !== undefined && /\borders?\b/i.test(question)) {
    return {
      name: FIND_ORDERS,
      input: { customerNo: customer.toUpperCase() },
    };
  }
  if (/\b(short|waiting)\b[^.?!]*\bstock\b/i.test(question)) {
    return { name: FIND_ORDERS, input: { waitingForStock: true } };
  }
  if (/\b(latest|recent|newest)\s+orders\b/i.test(question)) {
    return { name: FIND_ORDERS, input: {} };
  }
  return null;
}

/** The sentence for what a tool returned. Anything but our own three tools reads as nothing. */
function sentenceFor(result: AiToolResultPart): string {
  if (result.isError) return SPARK_REFUSED_REPLY;
  const data = unfenced(result.output);
  switch (result.name) {
    case CHECK_STOCK:
      return stockSentenceOf(data);
    case FIND_ORDERS:
      return ordersSentenceOf(data);
    case GET_ORDER:
      return orderSentenceOf(data);
    default:
      return SPARK_UNREADABLE_REPLY;
  }
}

/**
 * Spark's script for the offline mock. A plain function of the request, as
 * every script is, so the same question gives the same answer. It asks for a
 * tool when the question is one of the few it knows, then says what the tool
 * returned; for any other question it says what it can do. It never lets a
 * missing script or an unknown question surface as an error.
 */
export const sparkMockScript: MockScript = (context) => {
  const last = context.toolResults.at(-1);
  if (last !== undefined) return mockText(sentenceFor(last));
  const call = callFor(lastQuestionOf(context));
  return call === null ? mockText(SPARK_CANNOT_REPLY) : mockToolCalls([call]);
};

/** Registers the script once, when the API starts, in the registry the mock provider reads. */
@Injectable()
export class SparkMockScripts implements OnModuleInit {
  constructor(
    @Inject(MockScriptRegistry) private readonly registry: MockScriptRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(SPARK_FEATURE, sparkMockScript);
  }
}
