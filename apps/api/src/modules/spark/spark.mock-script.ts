import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  MockScriptRegistry,
  mockText,
  type MockScript,
} from "../ai/providers/mock-scripts.js";
import { SPARK_FEATURE } from "./domain/spark-instructions.js";
/**
 * What the mock says to every question until Spark has tools to answer from.
 * It claims nothing: the mock never invents a figure, and with no tool result
 * in front of it there is nothing to state.
 */
export const SPARK_NO_TOOLS_REPLY =
  "I cannot look anything up yet: none of my read-only tools are connected in this version. I do not guess, so I have no answer to give.";

/**
 * Spark's script for the offline mock. A plain function of the request, as
 * every script is, so the same question gives the same answer. The tools'
 * steps are added to it by the story that adds the tools: it must then read
 * the LAST user message and the number of tool results, never `turn` or
 * `userText`, which count the earlier turns of the conversation too.
 */
export const sparkMockScript: MockScript = () => mockText(SPARK_NO_TOOLS_REPLY);

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
