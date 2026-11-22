import type { Permission } from "@orderpilot/shared";
import type { z } from "zod";
import type { AiActor } from "./ai-call-context.js";
import type { JsonValue } from "./llm-provider.js";

// A tool is the only thing a model can ask for besides an answer, and every
// tool is read-only by construction: it answers a question, it changes
// nothing. A feature builds its tools from its own read services and passes
// them to ONE call. There is no registry a model could reach into, and no way
// to register a tool that writes: this module imports no service at all.

/** What a running tool is told about the call it serves. */
export interface ToolContext {
  /** The person the call runs for. Never the system: the tool acts with their permissions. */
  readonly actor: AiActor;
  readonly traceId: string;
  readonly documentId?: string;
  /**
   * Fires only when a stream is stopped early (its reader quits). The text and
   * object calls have no deadline of their own and never fire it: each provider
   * request has its own timeout, and a slow tool is not told to stop. A tool
   * should stop and not write anything when it fires.
   */
  readonly signal: AbortSignal;
}

/** Names providers accept: letters, digits, underscore and hyphen, at most 64. */
const TOOL_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export interface ReadOnlyTool<S extends z.ZodType = z.ZodType> {
  readonly name: string;
  /** What the model reads to choose the tool. Trusted text of ours, never a document's. */
  readonly description: string;
  /** What the model must send. The loop parses with this before `execute` ever runs. */
  readonly inputSchema: S;
  /** The permission the ASKING PERSON's role must hold. The loop asks; the tool never decides. */
  readonly permission: Permission;
  /** Receives parsed input. The answer goes back to the model as fenced data. */
  execute(input: z.output<S>, context: ToolContext): Promise<JsonValue>;
}

/** Checks the name once, where the tool is made, so a bad one fails at start-up and not in a call. */
export function defineReadOnlyTool<S extends z.ZodType>(
  tool: ReadOnlyTool<S>,
): ReadOnlyTool<S> {
  if (!TOOL_NAME.test(tool.name)) {
    throw new RangeError(
      "A tool name is letters, digits, underscore and hyphen, starting with a letter, at most 64 long.",
    );
  }
  if (tool.description.trim() === "") {
    throw new RangeError("A tool needs a description for the model to read.");
  }
  return tool;
}
