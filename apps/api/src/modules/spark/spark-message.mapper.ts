import {
  aiProviderSettingSchema,
  sparkErrorCodeSchema,
  sparkSourceSchema,
  sparkStepSchema,
  type SparkConversation,
  type SparkMessage,
} from "@orderpilot/shared";
import type {
  StoredConversation,
  StoredMessage,
} from "./spark-conversation.repository.js";

/** What a person reads of a stored conversation. */
export function conversationOf(stored: StoredConversation): SparkConversation {
  return {
    id: stored.id,
    title: stored.title,
    createdAt: stored.createdAt.toISOString(),
    updatedAt: stored.updatedAt.toISOString(),
    messageCount: stored.messageCount,
  };
}

/**
 * What a person reads of a stored message. The JSON columns are read through
 * their schemas, so a row that no longer fits shows as empty and never as an
 * error page. Tokens are not here: the usage record holds them.
 */
export function messageOf(stored: StoredMessage): SparkMessage {
  const provider = aiProviderSettingSchema.safeParse(stored.provider);
  return {
    id: stored.id,
    conversationId: stored.conversationId,
    seq: stored.seq,
    role: stored.role,
    status: stored.status,
    text: stored.content,
    sources: sparkSourceSchema.array().catch([]).parse(stored.sources),
    steps: sparkStepSchema.array().catch([]).parse(stored.steps),
    provider:
      provider.success && stored.model !== null && stored.mock !== null
        ? { provider: provider.data, model: stored.model, mock: stored.mock }
        : null,
    errorCode: sparkErrorCodeSchema
      .nullable()
      .catch(null)
      .parse(stored.errorCode),
    createdAt: stored.createdAt.toISOString(),
  };
}
