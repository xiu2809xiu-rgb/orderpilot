import type { PageMeta, PageQuery } from "@orderpilot/shared";
import { NotFoundError } from "./domain-error.js";

export interface Page<T> {
  readonly items: readonly T[];
  readonly meta: PageMeta;
}

/**
 * What a service may ask of a data source. Services depend on this, never on
 * Prisma: repositories implement it, and the only place Prisma is called is
 * inside them.
 */
export interface Repository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  list(query: PageQuery): Promise<Page<TEntity>>;
}

/**
 * The base of every repository. It holds the rules that do not depend on the
 * database: a missing record is a NotFoundError, and a page has the shape the
 * API returns. A subclass supplies `findById` and `list`.
 */
export abstract class BaseRepository<TEntity, TId> implements Repository<
  TEntity,
  TId
> {
  /** Names the record in the error message, such as "Order". */
  protected abstract readonly entityName: string;

  abstract findById(id: TId): Promise<TEntity | null>;
  abstract list(query: PageQuery): Promise<Page<TEntity>>;

  async getById(id: TId): Promise<TEntity> {
    const found = await this.findById(id);
    if (found === null) throw new NotFoundError(this.entityName);
    return found;
  }

  protected toPage(
    items: readonly TEntity[],
    total: number,
    query: PageQuery,
  ): Page<TEntity> {
    return {
      items,
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }
}

/**
 * Keeps records in memory. For unit tests of services and for pieces that have
 * no table yet; not for data that must survive a restart.
 */
export abstract class InMemoryRepository<TEntity, TId> extends BaseRepository<
  TEntity,
  TId
> {
  protected abstract idOf(entity: TEntity): TId;

  private readonly records = new Map<TId, TEntity>();

  save(entity: TEntity): TEntity {
    this.records.set(this.idOf(entity), entity);
    return entity;
  }

  findById(id: TId): Promise<TEntity | null> {
    return Promise.resolve(this.records.get(id) ?? null);
  }

  list(query: PageQuery): Promise<Page<TEntity>> {
    const all = [...this.records.values()];
    const start = (query.page - 1) * query.pageSize;
    return Promise.resolve(
      this.toPage(all.slice(start, start + query.pageSize), all.length, query),
    );
  }
}
