import type { Classification, DataOrigin, Role } from "@orderpilot/shared";

/** The person on whose action the call runs. Tools run with this person's permissions, never the system's. */
export interface AiActor {
  readonly userId: string;
  readonly role: Role;
}

/**
 * What every gateway call must say about itself. There are no defaults for the
 * data fields on purpose: a caller that forgets `origin` or `classification`
 * does not compile, so nothing is sent under a guessed label.
 */
export interface AiCallContext {
  /** The product feature, such as "document-extraction". It keys the cost report. */
  readonly feature: string;
  readonly promptVersion: string;
  /** How sensitive the data is, as area 4's policy sees it. */
  readonly classification: Classification;
  /** Where the data came from. Real data goes only where the policy allows. */
  readonly origin: DataOrigin;
  /** Null for a background job. A call with no actor may not use tools. */
  readonly actor: AiActor | null;
  readonly traceId: string;
  readonly documentId?: string;
}
