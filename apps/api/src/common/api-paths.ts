/** URI versioning: /api/v1/... The shared base path is the contract with the web app. */
export const GLOBAL_PREFIX = "api";
export const DEFAULT_VERSION = "1";

/** Where Swagger UI is served. */
export const DOCS_PATH = `${GLOBAL_PREFIX}/docs`;

/** The probes live outside the prefix, so a version change never moves them. */
export const PROBE_PATHS = ["health", "health/live", "health/ready"] as const;

/** What the prefix and version make together. A test compares it with the shared constant. */
export function versionedBasePath(): string {
  return `/${GLOBAL_PREFIX}/v${DEFAULT_VERSION}`;
}
