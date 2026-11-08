/**
 * An attachment's link, or undefined when it is not safe to draw as one. Only
 * a relative URL or http(s) passes: data:, blob:, javascript: and the rest are
 * refused, as the template is the one place server-fed links cross.
 */
export function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    // The base makes a relative URL parse; a scheme in the input overrides it.
    const { protocol } = new URL(href, "https://relative.invalid/");
    return protocol === "https:" || protocol === "http:" ? href : undefined;
  } catch {
    return undefined;
  }
}
