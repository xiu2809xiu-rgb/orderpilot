import { Inject, Injectable } from "@nestjs/common";
import type {
  PoVersionDetail,
  PoVersionDifferences,
  PoVersionList,
  Role,
} from "@orderpilot/shared";
import {
  DomainError,
  NotFoundError,
  ValidationFailedError,
} from "../../common/domain-error.js";
import { UserRepository } from "../../users/user.repository.js";
import { OrderMasking } from "./domain/order-masking.js";
import {
  toDetail,
  toDifferencesView,
  toSummary,
} from "./domain/po-version-view.js";
import {
  PoVersionRepository,
  type PoVersionHistory,
  type StoredPoVersion,
} from "./po-version.repository.js";

/**
 * Reads the PO versions of a stored order (ADR 0074). Only a submitted order
 * has any: a draft is edited in place and a void order never was submitted. Every
 * price, total and line amount goes through the role's mask, and a difference is
 * built by `toDifferencesView`, which decides from the role whether prices are
 * compared at all.
 */
@Injectable()
export class PoVersionsService {
  constructor(
    @Inject(PoVersionRepository)
    private readonly poVersions: PoVersionRepository,
    @Inject(OrderMasking) private readonly masking: OrderMasking,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  /** Newest first. */
  async list(orderNo: string, role: Role): Promise<PoVersionList> {
    const history = await this.history(orderNo);
    const names = await this.namesOf(history.versions);
    return {
      orderNo: history.orderNo,
      currentPoVersionNo: history.versions.length,
      versions: [...history.versions]
        .reverse()
        .map((version) => toSummary(version, names, this.masking, role)),
    };
  }

  async one(
    orderNo: string,
    poVersionNo: number,
    role: Role,
  ): Promise<PoVersionDetail> {
    const history = await this.history(orderNo);
    const version = this.versionOf(history, poVersionNo);
    const names = await this.namesOf([version]);
    return toDetail(version, names, this.masking, role);
  }

  async diff(
    orderNo: string,
    from: number,
    to: number,
    role: Role,
  ): Promise<PoVersionDifferences> {
    const history = await this.history(orderNo);
    if (from >= to)
      throw new ValidationFailedError([
        {
          path: "to",
          message: "Compare an earlier PO version with a later one.",
        },
      ]);
    const earlier = this.versionOf(history, from);
    const later = this.versionOf(history, to);
    return toDifferencesView(
      { ...earlier.content, poVersionNo: earlier.poVersionNo },
      { ...later.content, poVersionNo: later.poVersionNo },
      this.masking,
      role,
    );
  }

  /** Every read starts here: an unknown order or a sample is a 404, a draft or a void order a 409. */
  private async history(orderNo: string): Promise<PoVersionHistory> {
    const history = await this.poVersions.historyOf(orderNo);
    if (!history) throw new NotFoundError("Order");
    if (history.captureState === "draft")
      throw new DomainError(
        "CONFLICT",
        `Order ${orderNo} is a draft, so it has no PO versions yet. It becomes PO version 1 when it is submitted.`,
        [{ path: "captureState", message: "draft" }],
      );
    if (history.captureState === "void")
      throw new DomainError(
        "CONFLICT",
        `Order ${orderNo} is void, so it has no PO versions.`,
        [{ path: "captureState", message: "void" }],
      );
    return history;
  }

  private versionOf(
    history: PoVersionHistory,
    poVersionNo: number,
  ): StoredPoVersion {
    const version = history.versions.find((v) => v.poVersionNo === poVersionNo);
    if (!version) throw new NotFoundError("PO version");
    return version;
  }

  private namesOf(
    versions: readonly StoredPoVersion[],
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const version of versions) {
      ids.add(version.arrivedBy);
      if (version.supersededBy !== null) ids.add(version.supersededBy);
    }
    return this.users.namesByIds([...ids]);
  }
}
