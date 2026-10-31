import type {
  ClickstreamBatch,
  ClickstreamEvent,
  ClickstreamEventName,
} from "@orderpilot/shared";

/** granted and denied are the person's choice; blocked is the browser's signal. */
export type ConsentState = "unset" | "granted" | "denied" | "blocked";

export const CONSENT_STORAGE_KEY = "op.analytics.consent";

/** The two browser signals that mean "do not track me". */
export interface PrivacySignals {
  readonly doNotTrack?: string | null;
  readonly globalPrivacyControl?: boolean;
}

export interface AnalyticsTrackerOptions {
  /** Sends one batch. The app passes the generated clickstream call. */
  readonly send: (batch: ClickstreamBatch) => Promise<unknown>;
  readonly storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  readonly signals?: PrivacySignals;
  /** Events held back until this many are waiting. */
  readonly batchSize?: number;
  /** A waiting batch is sent after this many milliseconds. */
  readonly flushAfterMs?: number;
  readonly now?: () => Date;
}

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_AFTER_MS = 5_000;

/** Browsers say it in two ways: navigator.doNotTrack "1", and Global Privacy Control. */
export function readPrivacySignals(nav: Navigator): PrivacySignals {
  const gpc = (nav as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl;
  return {
    doNotTrack: nav.doNotTrack,
    ...(gpc === undefined ? {} : { globalPrivacyControl: gpc }),
  };
}

/**
 * Records which screens are used, and nothing about who uses them (area 4).
 *
 *  - Nothing is recorded until the person says yes, and a browser signal
 *    (Do Not Track or Global Privacy Control) overrides any yes.
 *  - An event is a name, a route pattern and a time. The server adds the role
 *    from the session. There is no user id, no address and no raw URL: callers
 *    pass the pattern (`/orders/:id`), and the server refuses anything else.
 *  - Events are batched, and a failed send drops its batch rather than retry
 *    for ever: analytics must never get in the way of the work.
 */
export class AnalyticsTracker {
  private readonly send: AnalyticsTrackerOptions["send"];
  private readonly storage: NonNullable<AnalyticsTrackerOptions["storage"]>;
  private readonly signals: PrivacySignals;
  private readonly batchSize: number;
  private readonly flushAfterMs: number;
  private readonly now: () => Date;
  private queue: ClickstreamEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private choice: "granted" | "denied" | null;
  private readonly listeners = new Set<() => void>();

  constructor(options: AnalyticsTrackerOptions) {
    this.send = options.send;
    this.storage = options.storage ?? memoryStorage();
    this.signals = options.signals ?? {};
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushAfterMs = options.flushAfterMs ?? DEFAULT_FLUSH_AFTER_MS;
    this.now = options.now ?? (() => new Date());
    this.choice = this.readChoice();
  }

  get consent(): ConsentState {
    if (this.blockedByBrowser()) return "blocked";
    return this.choice ?? "unset";
  }

  get pending(): number {
    return this.queue.length;
  }

  grant(): void {
    if (this.blockedByBrowser()) return;
    this.setChoice("granted");
  }

  /** Also the way to withdraw consent: waiting events are thrown away, not sent. */
  deny(): void {
    this.setChoice("denied");
    this.discard();
  }

  /** Queues one event if, and only if, consent is given. */
  track(name: ClickstreamEventName, route: string): void {
    if (this.consent !== "granted") return;
    this.queue.push({ name, route, at: this.now().toISOString() });
    if (this.queue.length >= this.batchSize) {
      void this.flush();
    } else {
      this.timer ??= setTimeout(() => {
        void this.flush();
      }, this.flushAfterMs);
    }
  }

  async flush(): Promise<void> {
    this.clearTimer();
    if (this.queue.length === 0 || this.consent !== "granted") return;
    const events = this.queue;
    this.queue = [];
    try {
      await this.send({ events });
    } catch {
      // Dropped on purpose: the batch holds no personal data worth keeping safe,
      // and a retry loop could only add load to a server that is already struggling.
    }
  }

  /** For useSyncExternalStore: tells the banner when consent changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private blockedByBrowser(): boolean {
    return (
      this.signals.doNotTrack === "1" ||
      this.signals.doNotTrack === "yes" ||
      this.signals.globalPrivacyControl === true
    );
  }

  private readChoice(): "granted" | "denied" | null {
    try {
      const stored = this.storage.getItem(CONSENT_STORAGE_KEY);
      return stored === "granted" || stored === "denied" ? stored : null;
    } catch {
      // Storage can be blocked: the choice then lasts for this visit only.
      return null;
    }
  }

  private setChoice(choice: "granted" | "denied"): void {
    this.choice = choice;
    try {
      this.storage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // Not stored; asked again next visit.
    }
    for (const listener of this.listeners) listener();
  }

  private discard(): void {
    this.clearTimer();
    this.queue = [];
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

function memoryStorage(): NonNullable<AnalyticsTrackerOptions["storage"]> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

// Words only: any segment with a digit could be an id, so it becomes :value.
const SAFE_SEGMENT = /^[a-z]+(-[a-z]+)*$/;

/**
 * The route pattern of the page being shown: each value the router matched
 * becomes `:name`, and a segment that is not a plain word (an id the router
 * did not know about) becomes `:value`. A raw URL never leaves the page.
 */
export function routePattern(
  pathname: string,
  params: Readonly<Record<string, string | undefined>>,
): string {
  const byValue = new Map<string, string>();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && key !== "*") byValue.set(value, key);
  }
  const segments = pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => {
      const decoded = safeDecode(segment);
      const param = byValue.get(decoded);
      if (param !== undefined) return `:${param}`;
      return SAFE_SEGMENT.test(segment) ? segment : ":value";
    });
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
