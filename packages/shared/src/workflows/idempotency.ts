import { z } from "zod";

/**
 * The header a client sends with a command so that sending it again, after a
 * timeout or a second click, runs it once. The server answers the repeat with
 * the first answer. The name is the one the IETF draft and Stripe use.
 */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * A UUID fits, and so does any short key of plain characters, so a client that
 * makes its own keys can use them. Long enough that two attempts never share one
 * by chance. Exported so the OpenAPI document states the same rule.
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;

export const idempotencyKeySchema = z
  .string()
  .regex(
    IDEMPOTENCY_KEY_PATTERN,
    "An Idempotency-Key is 8 to 100 letters, digits, dots, colons, dashes or underscores.",
  );

/** What a key used before for a different request is refused with. */
export const IDEMPOTENCY_KEY_REUSED_MESSAGE =
  "This Idempotency-Key was already used for a different request. Send a new key.";

/** What a copy is told when the first one with its key is still running after the wait. */
export const IDEMPOTENCY_KEY_IN_PROGRESS_MESSAGE =
  "A request with this Idempotency-Key is still being processed. Try again in a moment.";
