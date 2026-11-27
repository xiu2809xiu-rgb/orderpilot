/**
 * The one place a rule asks what time it is. Pure domain classes take `now`
 * as an argument; services read it from here, so a test can pass one fixed
 * moment instead of faking timers (which would also move the JWT expiry check
 * and the argon2 timing). Audit timestamps are still written by the audit
 * service from the real clock.
 */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
