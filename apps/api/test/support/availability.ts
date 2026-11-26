import {
  errorEnvelopeSchema,
  type PersonAvailability,
} from "@orderpilot/shared";
import type request from "supertest";
import { Clock } from "../../src/common/clock.js";
import { API, call, type Browser } from "./auth.js";
import type { TestApp } from "./test-app.js";

/** One fixed moment, years from real time, so a service that reads new Date() fails. */
export const NOW = new Date("2031-03-01T09:00:00.000Z");
export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const MINE = `${API}/availability/mine`;
export const LOOKUP = `${API}/availability`;

/** A clock a test moves by hand. */
export class HandClock extends Clock {
  private current = new Date(NOW);

  now(): Date {
    return new Date(this.current);
  }

  set(at: Date): void {
    this.current = new Date(at);
  }
}

export const codeOf = (body: unknown): string =>
  errorEnvelopeSchema.parse(body).error.code;

/** The time `offsetMs` after the fixed moment, as the API writes it. */
export const iso = (offsetMs: number): string =>
  new Date(NOW.getTime() + offsetMs).toISOString();

export const idOf = (browser: Browser): string => browser.session.user.id;

/**
 * Calls of the availability routes as a browser would make them. The write is
 * limited to 30 a minute for the whole app, and a refused call counts too, so
 * a file that is not about the limit counts its own writes and fails loudly
 * before the limit could turn a test into a 429.
 */
export function availabilityCalls(t: TestApp, writeBudget: number) {
  let writes = 0;
  return {
    put(
      browser: Browser | null,
      body: object,
      options: { csrf?: boolean | string } = {},
    ): request.Test {
      writes += 1;
      if (writes > writeBudget) {
        throw new Error(
          `this file made more than its ${String(writeBudget)} writes`,
        );
      }
      return call(t, browser, "put", MINE, {
        csrf: options.csrf ?? true,
        body,
      });
    },
    set(browser: Browser, value: PersonAvailability): request.Test {
      return this.put(browser, { value });
    },
    mine: (browser: Browser | null): request.Test =>
      call(t, browser, "get", MINE),
    lookup: (browser: Browser | null, ids: string): request.Test =>
      call(t, browser, "get", `${LOOKUP}?ids=${ids}`),
  };
}
