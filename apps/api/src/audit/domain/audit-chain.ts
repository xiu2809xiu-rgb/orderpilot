import { createHash } from "node:crypto";
import type { AuditEvent } from "@orderpilot/shared";

/** Everything about an event except the hashes. */
export type AuditEventBody = Omit<AuditEvent, "prevHash" | "hash">;

/** JSON with object keys in sorted order, so one value always gives one text. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError("A non-finite number cannot be hashed");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export type ChainProblem = "prevHash-mismatch" | "hash-mismatch";

export interface ChainReport {
  readonly ok: boolean;
  readonly checked: number;
  /** The first event that does not fit, when `ok` is false. */
  readonly brokenAt: {
    readonly id: string;
    readonly problem: ChainProblem;
  } | null;
}

/** Bump when the hashed fields change, so old events still verify. */
const HASH_VERSION = 1;

/**
 * The hash of one event: SHA-256 over its fields and the hash of the event
 * before it (null for the first).
 */
export function hashEvent(
  body: AuditEventBody,
  prevHash: string | null,
): string {
  const text = canonicalJson({ v: HASH_VERSION, ...body, prevHash });
  return createHash("sha256").update(text).digest("hex");
}

/** Checks a whole trail, oldest event first. */
export function verifyEvents(events: Iterable<AuditEvent>): ChainReport {
  const verifier = new ChainVerifier();
  for (const event of events) {
    if (!verifier.accept(event)) break;
  }
  return verifier.report();
}

/**
 * The rules of the audit hash chain, with no database in sight.
 *
 * Change any field of any event, or remove or reorder one in the middle, and
 * every hash from there on stops matching. The append-only trigger stops
 * edits; the chain shows the ones that got around it. It checks events one at
 * a time, so a long trail never sits in memory.
 */
export class ChainVerifier {
  private previous: string | null = null;
  private checked = 0;
  private broken: ChainReport["brokenAt"] = null;

  /** Returns false at the first event that does not fit. */
  accept(event: AuditEvent): boolean {
    if (this.broken) return false;
    const { prevHash, hash, ...body } = event;
    const problem: ChainProblem | null =
      prevHash !== this.previous
        ? "prevHash-mismatch"
        : hash !== hashEvent(body, prevHash)
          ? "hash-mismatch"
          : null;
    if (problem) {
      this.broken = { id: event.id, problem };
      return false;
    }
    this.previous = hash;
    this.checked += 1;
    return true;
  }

  report(): ChainReport {
    return {
      ok: this.broken === null,
      checked: this.checked,
      brokenAt: this.broken,
    };
  }
}
