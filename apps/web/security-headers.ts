// The response headers the web image will send (nginx, P-13), served today by
// `vite preview` so the production build is proved under the same policy.
// ADR 0015 says why styles may be inline and scripts may not.

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Radix and sonner-style libraries set inline styles at run time.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  // Fonts are files we serve. Vite is told never to inline them as data: URIs.
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
