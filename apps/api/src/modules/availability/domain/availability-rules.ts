import {
  PERSON_AVAILABILITY_HOLD_HOURS,
  type PersonAvailability,
} from "@orderpilot/shared";

/** A choice is stored only while it differs from the default: no row means Available. */
export type StoredAvailabilityState = Exclude<PersonAvailability, "AVAILABLE">;

export interface StoredAvailability {
  readonly state: StoredAvailabilityState;
  readonly setAt: Date;
}

/** What a reader is shown. Null times mean nothing is set. */
export interface EffectiveAvailability {
  readonly value: PersonAvailability;
  readonly setAt: Date | null;
  readonly expiresAt: Date | null;
}

/**
 * How far ahead of the server's clock a row may be stamped and still count.
 * The one tolerance in this feature: the server stamps every row itself, so a
 * row ahead of the clock means the clock stepped back. Beyond this it is a
 * clock fault, and the row is not shown.
 */
export const CLOCK_SKEW_MINUTES = 5;

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/**
 * When a choice of Focusing or Do not disturb ends (ADR 0070), worked out when
 * it is read. There is no job and no clock in here: `now` is always an
 * argument, so a test passes one fixed moment.
 */
export class AvailabilityRules {
  private static readonly HOLD_MS = PERSON_AVAILABILITY_HOLD_HOURS * HOUR_MS;
  private static readonly SKEW_MS = CLOCK_SKEW_MINUTES * MINUTE_MS;

  /**
   * The availability to show for a stored row, or the default for no row, an
   * expired one, or one stamped further ahead than the skew. A row is live
   * while `now - setAt` is under 12 hours (live at 11 h 59 min 59.999 s, gone
   * at exactly 12 h). `expiresAt` is `setAt` plus 12 hours and is never capped:
   * a capped end would be recomputed on every read and could show for far
   * longer than the 12 hours that the card promises.
   */
  effective(row: StoredAvailability | null, now: Date): EffectiveAvailability {
    if (row === null || !this.isLive(row, now)) {
      return { value: "AVAILABLE", setAt: null, expiresAt: null };
    }
    return {
      value: row.state,
      setAt: row.setAt,
      expiresAt: new Date(row.setAt.getTime() + AvailabilityRules.HOLD_MS),
    };
  }

  /** Rows stamped at or before this are expired. */
  cutoff(now: Date): Date {
    return new Date(now.getTime() - AvailabilityRules.HOLD_MS);
  }

  /** Rows stamped after this are a clock fault. */
  latest(now: Date): Date {
    return new Date(now.getTime() + AvailabilityRules.SKEW_MS);
  }

  private isLive(row: StoredAvailability, now: Date): boolean {
    return (
      now.getTime() - row.setAt.getTime() < AvailabilityRules.HOLD_MS &&
      row.setAt.getTime() <= this.latest(now).getTime()
    );
  }
}
