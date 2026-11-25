import { Inject, Injectable } from "@nestjs/common";
import type {
  PageQuery,
  SparkMessageRole,
  SparkMessageStatus,
  SparkSource,
  SparkStep,
} from "@orderpilot/shared";
import { ConflictError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { Prisma } from "../../generated/prisma/client.js";

/**
 * Whose conversations a caller may reach: their own, and in a demo session
 * only those of that session. A demo sign-in gives everyone of a role the same
 * user, so the user alone would show a tester another's questions.
 */
export interface SparkScope {
  readonly userId: string;
  /** The sign-in session of a demo sign-in; null for a real one. */
  readonly sessionId: string | null;
}

export interface StoredConversation {
  readonly id: string;
  readonly title: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly messageCount: number;
}

export interface StoredMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly seq: number;
  readonly role: SparkMessageRole;
  readonly status: SparkMessageStatus;
  readonly content: string;
  readonly sources: unknown;
  readonly steps: unknown;
  readonly actorRole: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly mock: boolean | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly finishReason: string | null;
  readonly errorCode: string | null;
  readonly traceId: string;
  readonly createdAt: Date;
}

export interface NewMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly seq: number;
  readonly role: SparkMessageRole;
  readonly status: SparkMessageStatus;
  readonly content: string;
  readonly sources?: readonly SparkSource[];
  readonly steps?: readonly SparkStep[];
  readonly actorRole: string;
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly mock?: boolean | null;
  readonly inputTokens?: number | null;
  readonly outputTokens?: number | null;
  readonly finishReason?: string | null;
  readonly errorCode?: string | null;
  readonly traceId: string;
}

/** The most messages one read returns. A conversation this long is a thread nobody can follow. */
export const MAX_MESSAGES_READ = 500;

const WITH_COUNT = {
  _count: { select: { messages: true } },
} satisfies Prisma.SparkConversationInclude;

type ConversationRow = Prisma.SparkConversationGetPayload<{
  include: typeof WITH_COUNT;
}>;

const toConversation = (row: ConversationRow): StoredConversation => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  messageCount: row._count.messages,
});

/** The only place the Spark tables are read or written. */
@Injectable()
export class SparkConversationRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async list(
    scope: SparkScope,
    query: PageQuery,
  ): Promise<{ items: StoredConversation[]; total: number }> {
    const where = { ...scopeWhere(scope), archivedAt: null };
    const [rows, total] = await Promise.all([
      this.database.client.sparkConversation.findMany({
        where,
        include: WITH_COUNT,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.sparkConversation.count({ where }),
    ]);
    return { items: rows.map(toConversation), total };
  }

  async create(
    scope: SparkScope,
    title: string | null,
  ): Promise<StoredConversation> {
    const row = await this.database.client.sparkConversation.create({
      data: { userId: scope.userId, sessionId: scope.sessionId, title },
      include: WITH_COUNT,
    });
    return toConversation(row);
  }

  /** Null for an unknown id, another person's, another demo session's and an archived one alike. */
  async find(
    scope: SparkScope,
    id: string,
  ): Promise<StoredConversation | null> {
    const row = await this.database.client.sparkConversation.findFirst({
      where: { id, ...scopeWhere(scope), archivedAt: null },
      include: WITH_COUNT,
    });
    return row ? toConversation(row) : null;
  }

  /** False when there was nothing of the caller's to archive. */
  async archive(scope: SparkScope, id: string, at: Date): Promise<boolean> {
    const { count } = await this.database.client.sparkConversation.updateMany({
      where: { id, ...scopeWhere(scope), archivedAt: null },
      data: { archivedAt: at },
    });
    return count > 0;
  }

  /** The newest messages of a conversation, oldest first. */
  async messages(conversationId: string): Promise<StoredMessage[]> {
    const rows = await this.database.client.sparkMessage.findMany({
      where: { conversationId },
      orderBy: { seq: "desc" },
      take: MAX_MESSAGES_READ,
    });
    return rows.reverse().map(toMessage);
  }

  /** Up to `limit` messages before `seq`, oldest first. */
  async before(
    conversationId: string,
    seq: number,
    limit: number,
  ): Promise<StoredMessage[]> {
    const rows = await this.database.client.sparkMessage.findMany({
      where: { conversationId, seq: { lt: seq } },
      orderBy: { seq: "desc" },
      take: limit,
    });
    return rows.reverse().map(toMessage);
  }

  async last(conversationId: string): Promise<StoredMessage | null> {
    const row = await this.database.client.sparkMessage.findFirst({
      where: { conversationId },
      orderBy: { seq: "desc" },
    });
    return row ? toMessage(row) : null;
  }

  /**
   * Stores a message at a sequence number. Two questions that read the same
   * last message both try the next number, and the unique key lets only one of
   * them in: the other is a conflict, not a second answer in flight.
   */
  async append(message: NewMessage): Promise<StoredMessage> {
    try {
      const row = await this.database.client.sparkMessage.create({
        data: {
          id: message.id,
          conversationId: message.conversationId,
          seq: message.seq,
          role: message.role,
          status: message.status,
          content: message.content,
          sources: [...(message.sources ?? [])],
          steps: [...(message.steps ?? [])],
          actorRole: message.actorRole,
          provider: message.provider ?? null,
          model: message.model ?? null,
          mock: message.mock ?? null,
          inputTokens: message.inputTokens ?? null,
          outputTokens: message.outputTokens ?? null,
          finishReason: message.finishReason ?? null,
          errorCode: message.errorCode ?? null,
          traceId: message.traceId,
        },
      });
      return toMessage(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          "Spark is already answering a question in this conversation.",
        );
      }
      throw error;
    }
  }

  /** Moves the conversation to the top of the list, and names it if it has no name yet. */
  async touch(
    conversationId: string,
    at: Date,
    title: string | null,
  ): Promise<void> {
    await this.database.client.sparkConversation.update({
      where: { id: conversationId },
      data: { updatedAt: at, ...(title === null ? {} : { title }) },
    });
  }

  /** Questions a person has asked since `since`, in any of their conversations and sessions. */
  countQuestions(userId: string, since: Date): Promise<number> {
    return this.database.client.sparkMessage.count({
      where: {
        role: "USER",
        createdAt: { gte: since },
        conversation: { userId },
      },
    });
  }
}

const scopeWhere = (scope: SparkScope) => ({
  userId: scope.userId,
  sessionId: scope.sessionId,
});

type MessageRow = Prisma.SparkMessageGetPayload<Record<string, never>>;

const toMessage = (row: MessageRow): StoredMessage => ({
  id: row.id,
  conversationId: row.conversationId,
  seq: row.seq,
  role: row.role,
  status: row.status,
  content: row.content,
  sources: row.sources,
  steps: row.steps,
  actorRole: row.actorRole,
  provider: row.provider,
  model: row.model,
  mock: row.mock,
  inputTokens: row.inputTokens,
  outputTokens: row.outputTokens,
  finishReason: row.finishReason,
  errorCode: row.errorCode,
  traceId: row.traceId,
  createdAt: row.createdAt,
});
