import { Inject, Injectable } from "@nestjs/common";
import type { AiStatus } from "@orderpilot/shared";
import { LlmProvider } from "./domain/llm-provider.js";

/**
 * What the gateway is set to use, read from the provider it was built with.
 * It copies four plain fields and nothing else, so no key and no base URL can
 * reach a response: the provider holds the settings, this class never sees them.
 */
@Injectable()
export class AiStatusService {
  constructor(
    @Inject(LlmProvider)
    private readonly provider: Pick<
      LlmProvider,
      "name" | "kind" | "model" | "mock"
    >,
  ) {}

  status(): AiStatus {
    const { name, kind, model, mock } = this.provider;
    return { provider: name, kind, model, mock };
  }
}
