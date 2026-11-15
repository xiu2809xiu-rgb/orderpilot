/** The shapes a page can take while its code loads. */
export type RouteKind = "home" | "list" | "record" | "form" | "settings";

// A record opens from a list: /orders/<no>, /master-data/<section>/<no>, and the
// workflow steps and SPR pages. A route table cannot be read without loading
// the pages, so the shapes are listed here, next to the guess they make.
const RECORD_PATHS: readonly RegExp[] = [
  /^\/orders\/[^/]+$/,
  /^\/master-data\/[^/]+\/[^/]+$/,
  /^\/workflows\/(orders|sprs)\/[^/]+$/,
];

/**
 * Which skeleton to draw for an address, from the address alone. A guess is
 * cheap: a list that is drawn as a record only shifts when the real page
 * arrives, and the real page never waits for this.
 */
export function routeKindOf(pathname: string): RouteKind {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/settings") return "settings";
  if (path.endsWith("/new")) return "form";
  if (RECORD_PATHS.some((pattern) => pattern.test(path))) return "record";
  return "list";
}
