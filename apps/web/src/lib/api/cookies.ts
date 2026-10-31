/** Reads one cookie the page may see (the CSRF token; the others are httpOnly). */
export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const part of document.cookie.split("; ")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index) === name) {
      const value = part.slice(index + 1);
      return value === "" ? undefined : decodeURIComponent(value);
    }
  }
  return undefined;
}
