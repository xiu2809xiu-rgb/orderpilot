// The response headers the web image will send (nginx, P-13), served today by
// `vite preview` so the production build is proved under the same policy.
// ADR 0015 says why styles may be inline and scripts may not.

/**
 * Where the browser may send errors, from VITE_SENTRY_DSN. Nothing without a
 * DSN: the policy then stays exactly as strict as before (ADR 0022). Only an
 * https DSN counts, and only its origin goes into the policy.
 */
export function sentryOrigin(dsn: string | undefined): string | null {
  if (dsn === undefined || dsn === "") return null;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(sentryDsn?: string): string {
  const errorSink = sentryOrigin(sentryDsn);
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Radix and sonner-style libraries set inline styles at run time.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    // Fonts are files we serve. Vite is told never to inline them as data: URIs.
    "font-src 'self'",
    errorSink === null
      ? "connect-src 'self'"
      : `connect-src 'self' ${errorSink}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(sentryDsn?: string): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(sentryDsn),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

export const CONTENT_SECURITY_POLICY = contentSecurityPolicy();
export const SECURITY_HEADERS = securityHeaders();
