import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "./prisma.service.js";

/** What a repository queries: the client, or the open transaction. */
export type DbClient = Prisma.TransactionClient;

/**
 * Hands repositories the right client and lets a service run work in one
 * transaction.
 *
 * A service wraps a business change in `transaction(...)`. Every repository
 * call inside it, however deep, then uses that transaction through `client`,
 * with no client passed around. The audit writer joins the same transaction,
 * so a rollback leaves no audit event for work that never happened. A call
 * outside any transaction uses the plain client.
 */
@Injectable()
export class Database {
  private readonly open = new AsyncLocalStorage<DbClient>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The open transaction if there is one, else the shared client. */
  get client(): DbClient {
    return this.open.getStore() ?? this.prisma.client;
  }

  get inTransaction(): boolean {
    return this.open.getStore() !== undefined;
  }

  /**
   * Runs `work` in a transaction and commits when it resolves. Any throw rolls
   * everything back. Inside a transaction already, `work` simply joins it.
   */
  transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return work();
    return this.prisma.client.$transaction((tx) => this.open.run(tx, work));
  }

  /** Cheap round trip for the readiness check. */
  async ping(): Promise<void> {
    await this.prisma.client.$queryRaw`SELECT 1`;
  }
}
