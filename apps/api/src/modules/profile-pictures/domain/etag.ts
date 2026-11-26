/** The strong ETag of a stored picture: its SHA-256 in quotes. The bytes at a picture id never change. */
export function etagOf(sha256: string): string {
  return `"${sha256}"`;
}

/**
 * Does an If-None-Match header name this ETag? It may hold a list, a weak
 * form (W/"...") and `*`. A picture's ETag is strong, but a cache in between
 * may have made it weak, and a weak match is enough to say "not modified".
 */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false;
  return header.split(",").some((candidate) => {
    const trimmed = candidate.trim();
    if (trimmed === "*") return true;
    return (trimmed.startsWith("W/") ? trimmed.slice(2) : trimmed) === etag;
  });
}
