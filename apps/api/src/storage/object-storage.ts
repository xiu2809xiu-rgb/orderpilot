import { ValidationFailedError } from "../common/domain-error.js";

/** What is known about a stored object without reading its bytes. */
export interface ObjectInfo {
  readonly key: string;
  readonly size: number;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly lastModified: Date | null;
}

export interface StoredObject {
  readonly info: ObjectInfo;
  readonly body: Buffer;
}

export interface PutOptions {
  readonly contentType?: string;
}

/**
 * Document storage, in terms of the S3 API only: put, get, head, delete. The
 * S3 implementation serves MinIO today and AWS S3 later with a change of
 * configuration. Services depend on this class and never on the AWS SDK.
 */
export abstract class ObjectStorage {
  abstract put(
    key: string,
    body: Uint8Array | string,
    options?: PutOptions,
  ): Promise<ObjectInfo>;
  /** Null when there is no such object. */
  abstract get(key: string): Promise<StoredObject | null>;
  /** Null when there is no such object. */
  abstract head(key: string): Promise<ObjectInfo | null>;
  /** Deleting an object that is not there is not an error. */
  abstract delete(key: string): Promise<void>;
  /** Creates the bucket when it is missing. Safe to call again. */
  abstract ensureBucket(): Promise<void>;
  /** Resolves when the bucket is reachable. For the readiness check. */
  abstract ping(): Promise<void>;
}

const MAX_KEY_BYTES = 1_024;

/**
 * Keys are paths such as `documents/2026/11/<uuid>.pdf`. A key that could
 * climb out of its folder, or hide a control character in a log line, is
 * refused before it reaches the store.
 */
export function assertValidKey(key: string): void {
  const problems: string[] = [];
  if (key.length === 0) problems.push("is empty");
  if (Buffer.byteLength(key) > MAX_KEY_BYTES) problems.push("is too long");
  if (key.startsWith("/")) problems.push("starts with /");
  if (key.includes("\\")) problems.push("contains a backslash");
  // eslint-disable-next-line no-control-regex -- the point is to refuse them
  if (/[\u0000-\u001f\u007f]/.test(key))
    problems.push("contains a control character");
  if (
    key.split("/").some((part) => part === ".." || part === "." || part === "")
  ) {
    problems.push("has an empty, . or .. segment");
  }
  if (problems.length > 0) {
    throw new ValidationFailedError([
      { path: "key", message: `The storage key ${problems.join(" and ")}.` },
    ]);
  }
}
