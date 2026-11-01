/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Switches Sentry on in the browser. Unset, nothing is loaded or sent (ADR 0022). */
  readonly VITE_SENTRY_DSN?: string;
  /**
   * "true" brings planned features back, in a development build only. Read
   * from the root .env; a production build ignores it.
   */
  readonly VITE_SHOW_PLANNED?: string;
}
