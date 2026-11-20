export interface Crumb {
  path: string;
  label: string;
  mono?: boolean;
}

const plain = (path: string) => path.replace(/\/+$/, "") || "/";

/**
 * The trail of the top bar: the page and, before it, its parent. The parent
 * is the nearest earlier crumb that is a page of the role's menu, so every
 * link leads somewhere a person can go and nothing is named that is not a
 * page ("Master data" is a heading of the panel, not a page). Home is never
 * the parent: a top-level page shows its own name alone, and the panel is the
 * way back. A crumb on the page's own address is the same page, not a parent.
 */
export function buildTrail(
  pages: readonly Crumb[],
  menuPaths: ReadonlySet<string>,
): Crumb[] {
  const page = pages.at(-1);
  if (!page) return [];
  const parent = pages
    .slice(0, -1)
    .findLast(
      (crumb) =>
        plain(crumb.path) !== plain(page.path) &&
        plain(crumb.path) !== "/" &&
        menuPaths.has(plain(crumb.path)),
    );
  return parent ? [parent, page] : [page];
}
