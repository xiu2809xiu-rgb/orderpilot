import { z } from "zod";

// zod compiles faster parsers with `new Function`. The Content-Security-Policy
// forbids eval (script-src 'self'), so zod would try, be refused, and log a
// violation on every page load. Telling it not to try keeps the policy strict
// and the console quiet. ADR 0015.
z.config({ jitless: true });
