import { DomainError } from "../../../common/domain-error.js";
import type { HandoffAnswer, HandoffEffect } from "./order-handoff.js";
import { HandoffRefusedError } from "./order-errors.js";

/**
 * Calls the port and answers its effect. A DomainError from area 2 is wrapped
 * so that, outside the transaction, it can be told from one of our own and one
 * refusal row can be written after the rollback. Anything else is rethrown as
 * it is.
 */
export async function handOver(
  call: () => Promise<HandoffAnswer>,
): Promise<HandoffEffect> {
  try {
    return (await call()).effect;
  } catch (error) {
    throw error instanceof DomainError ? new HandoffRefusedError(error) : error;
  }
}
