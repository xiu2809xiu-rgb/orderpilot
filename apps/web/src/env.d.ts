/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Switches Sentry on in the browser. Unset, nothing is loaded or sent (ADR 0022). */
  readonly VITE_SENTRY_DSN?: string;
}
